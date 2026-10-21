import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { UserInputError } from 'apollo-server-express';

/**
 * Promo code configuration stored in the accounts database.
 */
export interface PromoCode {
  /**
   * Identifier referenced by successful redemptions and payment checksums.
   */
  _id: ObjectId;
  /**
   * Uppercase code without surrounding whitespace.
   */
  value: string;
  /**
   * Percentage discount for the current payment, from 1 to 99.
   */
  discountPercent: number;
  /**
   * Whether the code is unavailable for new payments.
   */
  isDisabled?: boolean;
  /**
   * Limit on successful uses; missing or invalid values mean unlimited use.
   */
  maxUses?: number;
  /**
   * Eligible plans; missing means all plans, while an empty array allows none.
   */
  planIds?: ObjectId[];
}

/**
 * Codes are stored in MongoDB in uppercase, without surrounding whitespace.
 *
 * @param code - user-provided code
 * @returns normalized code for indexed lookup
 */
export function normalizePromoCode(code: string): string {
  if (typeof code !== 'string' || !code.trim()) {
    throw new UserInputError('PROMO_CODE_INVALID');
  }

  return code.trim().toUpperCase();
}

/**
 * Invalid or absent limits mean unlimited use; numeric zero remains a limit.
 *
 * @param value - manually configured limit from MongoDB
 * @returns numeric limit or undefined for unlimited use
 */
export function getMaxUses(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return value;
}

/**
 * Reject unsupported discounts before preparing a payment.
 *
 * @param discountPercent - configured percentage for the current payment
 */
function validateDiscountPercent(discountPercent: number): void {
  if (!Number.isFinite(discountPercent) || discountPercent < 1 || discountPercent > 99) {
    throw new UserInputError('PROMO_CODE_INVALID');
  }
}

/**
 * Calculate the current payment in whole rubles, rounded up, with a 1 RUB floor.
 *
 * @param originalAmount - regular plan price in rubles
 * @param discountPercent - percentage discount, from 1 to 99
 * @returns discounted amount in whole rubles
 */
export function calculateDiscountedAmount(originalAmount: number, discountPercent: number): number {
  if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
    throw new UserInputError('PROMO_CODE_INVALID_AMOUNT');
  }

  validateDiscountPercent(discountPercent);

  const discountedAmount = originalAmount * (100 - discountPercent) / 100;
  const roundedAmount = Math.ceil(discountedAmount);

  return Math.max(1, roundedAmount);
}

/**
 * Missing planIds means all plans; a present array allows only its listed plans.
 * Usage limits count successful payments only.
 *
 * @param db - accounts database containing promoCodes
 * @param code - user-provided code
 * @param tariffPlanId - selected plan
 * @returns validated promo code
 */
export async function findActivePromoCode(db: Db, code: string, tariffPlanId: ObjectId): Promise<PromoCode> {
  const promoCode = await db.collection<PromoCode>('promoCodes').findOne({
    value: normalizePromoCode(code),
  });

  if (!promoCode || promoCode.isDisabled === true) {
    throw new UserInputError('PROMO_CODE_INVALID');
  }

  validateDiscountPercent(promoCode.discountPercent);

  if (promoCode.planIds !== undefined && (
    !Array.isArray(promoCode.planIds) ||
    !promoCode.planIds.some(id => id instanceof ObjectId && id.equals(tariffPlanId))
  )) {
    throw new UserInputError('PROMO_CODE_INVALID');
  }

  return {
    ...promoCode,
    maxUses: getMaxUses(promoCode.maxUses),
  };
}
