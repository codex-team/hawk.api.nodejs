import type { Db } from 'mongodb';
import { MongoServerError, ObjectId } from 'mongodb';
import { UserInputError } from 'apollo-server-express';
import { calculateDiscountedAmount, findActivePromoCode, getMaxUses } from './index';

/**
 * Server-calculated price snapshot used to sign a promo payment.
 */
export interface PromoCodeQuote {
  /**
   * Identifier of the applied promo code.
   */
  promoCodeId: ObjectId;
  /**
   * Full plan price in rubles before the discount.
   */
  originalAmount: number;
  /**
   * Discounted price in whole rubles, with a one-ruble minimum.
   */
  finalAmount: number;
  /**
   * Percentage discount captured when the quote was prepared.
   */
  discountPercent: number;
}

/**
 * Successful promo use, unique per code and user or workspace.
 */
export interface PromoCodeRedemption extends PromoCodeQuote {
  /**
   * Identifier of the successful usage record.
   */
  _id: ObjectId;
  /**
   * User who made the payment.
   */
  userId: ObjectId;
  /**
   * Workspace that received the paid plan.
   */
  workspaceId: ObjectId;
  /**
   * Plan purchased with the discount.
   */
  tariffPlanId: ObjectId;
  /**
   * Provider transaction identifier used to recognize callback retries.
   */
  transactionId: string;
}

/**
 * User input and server-resolved payment identity for preparing a quote.
 */
export interface PromoCodeInput {
  /**
   * User-provided code, normalized before lookup.
   */
  promoCode: string;
  /**
   * Authenticated payer.
   */
  userId: ObjectId;
  /**
   * Authorized workspace receiving the plan.
   */
  workspaceId: ObjectId;
  /**
   * Selected plan checked against the code's eligibility rules.
   */
  tariffPlanId: ObjectId;
  /**
   * Server-resolved full plan price in rubles.
   */
  originalAmount: number;
}

/**
 * Signed promo identity and price combined with provider callback fields.
 */
export interface PromoPayment {
  /**
   * Promo code identifier from the verified checksum.
   */
  promoCodeId: string;
  /**
   * Signed payment-attempt identifier, also used as the business operation ID.
   */
  promoPaymentId: string;
  /**
   * Payer identifier from the verified checksum.
   */
  userId: string;
  /**
   * Workspace identifier from the verified checksum.
   */
  workspaceId: string;
  /**
   * Purchased plan identifier from the verified checksum.
   */
  tariffPlanId: string;
  /**
   * Signed full plan price in rubles.
   */
  originalAmount: number;
  /**
   * Signed percentage discount for the payment.
   */
  discountPercent: number;
  /**
   * Signed discounted amount in rubles.
   */
  paymentAmount: number;
  /**
   * Provider transaction identifier from the callback.
   */
  transactionId: string;
  /**
   * Actual callback amount in rubles, compared with the signed quote.
   */
  amount: number;
  /**
   * Provider callback currency; promo payments require RUB.
   */
  currency: string;
}

/**
 * Check successful uses only. Parallel payments may both pass before either succeeds.
 *
 * @param db - accounts database
 * @param promoCodeId - selected code
 * @param userId - payer
 * @param workspaceId - paid workspace
 * @param transactionId - same successful callback retry, if present
 */
export async function checkPromoCodeUsage(
  db: Db,
  promoCodeId: ObjectId,
  userId: ObjectId,
  workspaceId: ObjectId,
  transactionId?: string
): Promise<void> {
  const redemptions = db.collection<PromoCodeRedemption>('promoCodeRedemptions');
  const existing = await redemptions.findOne({
    promoCodeId,
    $or: [ { userId }, { workspaceId } ],
  });

  if (existing) {
    const isSameSuccessfulPayment = transactionId &&
      existing.transactionId === transactionId &&
      existing.userId.equals(userId) &&
      existing.workspaceId.equals(workspaceId);

    if (isSameSuccessfulPayment) {
      return;
    }

    throw new UserInputError('PROMO_CODE_ALREADY_USED');
  }

  const promoCode = await db.collection('promoCodes').findOne({ _id: promoCodeId });

  if (!promoCode) {
    throw new UserInputError('PROMO_CODE_INVALID');
  }

  const maxUses = getMaxUses(promoCode.maxUses);

  if (maxUses !== undefined && await redemptions.countDocuments({ promoCodeId }) + 1 > maxUses) {
    throw new UserInputError('PROMO_CODE_INVALID');
  }
}

/**
 * Calculate a signed quote without writing a usage record.
 *
 * @param db - accounts database
 * @param input - requested payment
 * @returns discounted quote
 */
export async function preparePromoCode(db: Db, input: PromoCodeInput): Promise<PromoCodeQuote> {
  const promoCode = await findActivePromoCode(db, input.promoCode, input.tariffPlanId);
  const finalAmount = calculateDiscountedAmount(input.originalAmount, promoCode.discountPercent);

  await checkPromoCodeUsage(db, promoCode._id, input.userId, input.workspaceId);

  return {
    promoCodeId: promoCode._id,
    originalAmount: input.originalAmount,
    finalAmount,
    discountPercent: promoCode.discountPercent,
  };
}

/**
 * Validate the signed quote against the successful payment callback.
 *
 * @param payment - signed identity and provider callback fields
 */
export function validatePromoPayment(payment: PromoPayment): void {
  const ids = [payment.promoCodeId, payment.promoPaymentId, payment.userId, payment.workspaceId, payment.tariffPlanId];

  if (ids.some(id => typeof id !== 'string' || !ObjectId.isValid(id)) ||
    typeof payment.transactionId !== 'string' || !payment.transactionId.trim() || payment.currency !== 'RUB') {
    throw new UserInputError('PROMO_CODE_INVALID_PAYMENT');
  }

  const expectedAmount = calculateDiscountedAmount(payment.originalAmount, payment.discountPercent);

  if (payment.paymentAmount !== expectedAmount || payment.amount !== expectedAmount) {
    throw new UserInputError('PROMO_CODE_WRONG_AMOUNT');
  }
}

/**
 * Record promo usage only after the provider reports a successful payment.
 *
 * @param db - accounts database
 * @param payment - verified successful payment
 */
export async function recordPromoCodeUsage(db: Db, payment: PromoPayment): Promise<void> {
  validatePromoPayment(payment);

  const redemptions = db.collection<PromoCodeRedemption>('promoCodeRedemptions');
  const usage: PromoCodeRedemption = {
    _id: new ObjectId(),
    promoCodeId: new ObjectId(payment.promoCodeId),
    userId: new ObjectId(payment.userId),
    workspaceId: new ObjectId(payment.workspaceId),
    tariffPlanId: new ObjectId(payment.tariffPlanId),
    transactionId: payment.transactionId,
    originalAmount: payment.originalAmount,
    finalAmount: payment.paymentAmount,
    discountPercent: payment.discountPercent,
  };

  try {
    await redemptions.insertOne(usage);
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.code !== 11000) {
      throw error;
    }

    const existing = await redemptions.findOne({
      promoCodeId: usage.promoCodeId,
      $or: [ { userId: usage.userId }, { workspaceId: usage.workspaceId } ],
    });

    if (!existing) {
      throw error;
    }

    if (existing.transactionId !== payment.transactionId) {
      console.warn('Promo code was used by a parallel successful payment', payment.transactionId);
    }
  }
}
