import type { Db } from 'mongodb';
import { MongoServerError, ObjectId } from 'mongodb';
import { UserInputError } from 'apollo-server-express';
import { calculateDiscountedAmount, findActivePromoCode, getMaxUses } from './index';

export interface PromoCodeQuote {
  promoCodeId: ObjectId;
  originalAmount: number;
  finalAmount: number;
  discountPercent: number;
}

export interface PromoCodeRedemption extends PromoCodeQuote {
  _id: ObjectId;
  userId: ObjectId;
  workspaceId: ObjectId;
  tariffPlanId: ObjectId;
  transactionId: string;
}

export interface PromoCodeInput {
  promoCode: string;
  userId: ObjectId;
  workspaceId: ObjectId;
  tariffPlanId: ObjectId;
  originalAmount: number;
}

export interface PromoPayment {
  promoCodeId: string;
  promoPaymentId: string;
  userId: string;
  workspaceId: string;
  tariffPlanId: string;
  originalAmount: number;
  discountPercent: number;
  paymentAmount: number;
  transactionId: string;
  amount: number;
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
