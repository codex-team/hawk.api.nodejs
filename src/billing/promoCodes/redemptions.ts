import { ObjectId } from 'mongodb';
import { UserInputError } from 'apollo-server-express';
import { getMaxUses, PromoCode } from './index';
import { BusinessOperationDBScheme, BusinessOperationType } from '@hawk.so/types';
import type { PaymentData } from '../types/paymentData';

/**
 * Server-calculated price snapshot used to sign a promo payment.
 */
export interface PromoCodeQuote {
  promoCodeId: ObjectId;
  originalAmount: number;
  finalAmount: number;
}

/**
 * Successful promo use, unique per code and user or workspace.
 */
export interface PromoCodeRedemption extends PromoCodeQuote {
  _id: ObjectId;
  userId: ObjectId;
  workspaceId: ObjectId;
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
  promoCode: string;
  userId: ObjectId;
  workspaceId: ObjectId;
  tariffPlanId: ObjectId;
  originalAmount: number;
}

/**
 * Verified signed identity and prices combined with provider callback fields.
 */
export interface PromoPayment {
  promoCodeId: string;
  originalAmount: number;
  finalAmount: number;
  userId: string;
  workspaceId: string;
  tariffPlanId: string;
  transactionId: string;
  paidAmount: number;
  currency: string;
}

/**
 * Check successful uses only, allowing retries of the same successful payment.
 *
 * @param promoCode - already fetched code
 * @param identity - payer and paid workspace
 * @param existing - successful use by this payer or workspace, if any
 * @param successfulUses - number of successful uses of this code
 * @param transactionId - provider transaction on callback retries
 */
export function ensurePromoCodeAvailable(
  promoCode: PromoCode,
  identity: Pick<PromoCodeInput, 'userId' | 'workspaceId'>,
  existing: PromoCodeRedemption | null,
  successfulUses: number,
  transactionId?: string
): void {
  if (existing) {
    if (transactionId && existing.transactionId === transactionId &&
      existing.userId.equals(identity.userId) && existing.workspaceId.equals(identity.workspaceId)) {
      return;
    }

    throw new UserInputError('PROMO_CODE_ALREADY_USED');
  }

  const maxUses = getMaxUses(promoCode.maxUses);

  /*
   * shortcut: maxUses is a soft limit; parallel successes may exceed it, revisit only after product decides hard-cap semantics.
   */
  if (maxUses !== undefined && successfulUses + 1 > maxUses) {
    throw new UserInputError('PROMO_CODE_INVALID');
  }
}

/**
 * Validate the signed final amount against the provider payment, never recomputing discounts.
 *
 * @param payment - verified signed identity and provider callback fields
 */
export function validatePromoPayment(payment: PromoPayment): void {
  const ids = [payment.promoCodeId, payment.userId, payment.workspaceId, payment.tariffPlanId];

  if (ids.some(id => typeof id !== 'string' || !ObjectId.isValid(id)) ||
    typeof payment.transactionId !== 'string' || !payment.transactionId.trim() || payment.currency !== 'RUB') {
    throw new UserInputError('PROMO_CODE_INVALID_PAYMENT');
  }

  if (!Number.isFinite(payment.originalAmount) || payment.originalAmount <= 0 ||
    !Number.isSafeInteger(payment.finalAmount) || payment.finalAmount < 1 ||
    payment.finalAmount > Math.max(1, Math.ceil(payment.originalAmount)) ||
    payment.paidAmount !== payment.finalAmount) {
    throw new UserInputError('PROMO_CODE_WRONG_AMOUNT');
  }
}

/**
 * Reject callbacks that do not match the purchase accepted by /check.
 *
 * @param payment - verified payment
 * @param operation - purchase loaded by the provider transaction ID
 */
export function validatePromoOperation(payment: PromoPayment, operation: Pick<BusinessOperationDBScheme, 'type' | 'payload' | 'transactionId'>): void {
  validatePromoPayment(payment);
  const payload = operation.payload;

  if (operation.transactionId !== payment.transactionId ||
    operation.type !== BusinessOperationType.WorkspacePlanPurchase ||
    !('tariffPlanId' in payload) ||
    payload.workspaceId.toString() !== payment.workspaceId ||
    payload.userId.toString() !== payment.userId ||
    payload.tariffPlanId.toString() !== payment.tariffPlanId ||
    payload.amount !== payment.paidAmount * 100 || payload.currency !== payment.currency) {
    throw new UserInputError('PROMO_CODE_INVALID_PAYMENT');
  }
}

/**
 * Keep future subscription charges at full price after a discounted first payment.
 *
 * @param data - signed payment data and widget subscription settings
 * @param monthlyCharge - current full plan price
 * @param isDebug - whether the workspace uses daily billing
 */
export function validatePromoSubscription(data: PaymentData, monthlyCharge: number, isDebug: boolean): void {
  const recurrent = data.cloudPayments?.recurrent;

  if (recurrent && (
    recurrent.amount !== monthlyCharge || recurrent.period !== 1 ||
    recurrent.interval !== (isDebug ? 'Day' : 'Month') ||
    !data.nextPaymentDate ||
    Date.parse(recurrent.startDate || '') !== Date.parse(data.nextPaymentDate)
  )) {
    throw new UserInputError('PROMO_CODE_INVALID_SUBSCRIPTION');
  }
}
