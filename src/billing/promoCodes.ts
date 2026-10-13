import type { Db, ObjectId } from 'mongodb';
import { UserInputError } from 'apollo-server-express';

export interface PromoCode {
  _id: ObjectId;
  value: string;
  discountPercent: number;
  isActive: boolean;
  createdAt: Date;
  validFrom?: Date;
  validUntil?: Date;
  maxUses?: number;
}

/**
 * Codes are stored in MongoDB in uppercase, without surrounding whitespace.
 *
 * @param code - user-provided code
 * @returns normalized code for indexed lookup
 */
export function normalizePromoCode(code: string): string {
  if (typeof code !== 'string' || !code.trim()) {
    throw new UserInputError('PROMO_CODE_NOT_FOUND');
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
    throw new UserInputError('PROMO_CODE_INVALID_DISCOUNT');
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
 * Reject malformed dates in manually configured promo codes.
 *
 * @param date - optional BSON date stored in the promo code document
 */
function validatePromoDate(date: Date | undefined): void {
  if (date !== undefined && (!(date instanceof Date) || !Number.isFinite(date.getTime()))) {
    throw new UserInputError('PROMO_CODE_INVALID_DATES');
  }
}

/**
 * Validate the code configuration without reserving or consuming a use.
 * The validUntil boundary is exclusive. Usage limits are enforced at reservation.
 *
 * @param db - accounts database containing promoCodes
 * @param code - user-provided code
 * @param now - validation time
 */
export async function findActivePromoCode(db: Db, code: string, now = new Date()): Promise<PromoCode> {
  const normalizedCode = normalizePromoCode(code);
  const promoCode = await db.collection<PromoCode>('promoCodes').findOne({
    value: normalizedCode,
  });

  if (!promoCode) {
    throw new UserInputError('PROMO_CODE_NOT_FOUND');
  }

  if (promoCode.isActive !== true) {
    throw new UserInputError('PROMO_CODE_INACTIVE');
  }

  const { discountPercent, validFrom, validUntil } = promoCode;

  validateDiscountPercent(discountPercent);
  validatePromoDate(validFrom);
  validatePromoDate(validUntil);

  if (validFrom && validUntil && validFrom >= validUntil) {
    throw new UserInputError('PROMO_CODE_INVALID_DATES');
  }

  if (validFrom && now < validFrom) {
    throw new UserInputError('PROMO_CODE_NOT_STARTED');
  }

  if (validUntil && now >= validUntil) {
    throw new UserInputError('PROMO_CODE_EXPIRED');
  }

  return {
    ...promoCode,
    maxUses: getMaxUses(promoCode.maxUses),
  };
}
