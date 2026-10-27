import { ObjectId } from 'mongodb';
import { UserInputError } from 'apollo-server-express';

/**
 * Discount applied to the current payment, in percent or RUB.
 */
export interface PromoCodeDiscount {
  type: 'percent' | 'fixed';
  value: number;
}

/**
 * Promo code configuration stored in the accounts database.
 */
export interface PromoCode {
  _id: ObjectId;
  /**
   * Uppercase code without surrounding whitespace.
   */
  value: string;
  discount: PromoCodeDiscount;
  isDisabled?: boolean;
  /**
   * Soft limit on successful uses; missing or invalid values mean unlimited use.
   */
  maxUses?: number;
  /**
   * Missing means all plans; an empty array allows none.
   */
  planIds?: ObjectId[];
}

/**
 * Normalize user input for indexed lookup.
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
 * Calculate whole rubles, rounded up, with a 1 RUB floor.
 *
 * @param discount - configured percent (integer 1–99) or fixed RUB discount
 * @param originalAmount - regular plan price in rubles
 * @returns discounted amount in whole rubles
 */
export function applyDiscount(discount: PromoCodeDiscount, originalAmount: number): number {
  if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
    throw new UserInputError('PROMO_CODE_INVALID_AMOUNT');
  }

  if (!discount || !Number.isFinite(discount.value) || discount.value <= 0 ||
    (discount.type !== 'percent' && discount.type !== 'fixed') ||
    (discount.type === 'percent' && (!Number.isInteger(discount.value) || discount.value > 99))) {
    throw new UserInputError('PROMO_CODE_INVALID');
  }

  const discountedAmount = discount.type === 'percent'
    ? originalAmount * (100 - discount.value) / 100
    : originalAmount - discount.value;

  return Math.max(1, Math.ceil(discountedAmount));
}

/**
 * Check current availability and plan restrictions without recalculating a signed price.
 *
 * @param promoCode - stored promo code, if found
 * @param tariffPlanId - selected plan
 */
export function ensureActivePromoCode(promoCode: PromoCode | null, tariffPlanId: ObjectId): asserts promoCode is PromoCode {
  if (!promoCode || promoCode.isDisabled === true) {
    throw new UserInputError('PROMO_CODE_INVALID');
  }

  if (promoCode.planIds !== undefined && (
    !Array.isArray(promoCode.planIds) ||
    !promoCode.planIds.some(id => id instanceof ObjectId && id.equals(tariffPlanId))
  )) {
    throw new UserInputError('PROMO_CODE_INVALID');
  }
}
