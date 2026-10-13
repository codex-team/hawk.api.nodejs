import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import {
  calculateDiscountedAmount,
  findActivePromoCode,
  getMaxUses,
  normalizePromoCode,
  PromoCode
} from '../../src/billing/promoCodes';

const NOW = new Date('2026-10-13T12:00:00.000Z');

describe('Promo code normalization', () => {
  test('should trim whitespace and normalize case', () => {
    const code = '  sale20  ';

    const result = normalizePromoCode(code);

    expect(result).toBe('SALE20');
  });

  test.each(['', '  '])('should reject an empty code: %j', code => {
    const invalidCode = code;

    const action = (): string => normalizePromoCode(invalidCode);

    expect(action).toThrow('PROMO_CODE_NOT_FOUND');
  });
});

describe('Promo code usage limit', () => {
  test.each([0, 1, 10])('should preserve numeric limit %j', value => {
    const configuredLimit = value;

    const result = getMaxUses(configuredLimit);

    expect(result).toBe(value);
  });

  test.each([undefined, null, -1, '10', '0', 'invalid', NaN, Infinity, false])(
    'should treat %j as unlimited without converting strings', value => {
      const configuredLimit = value;

      const result = getMaxUses(configuredLimit);

      expect(result).toBeUndefined();
    }
  );
});

describe('Discounted payment amount', () => {
  test.each([
    [100, 20, 80],
    [101, 20, 81],
    [20, 99, 1],
    [1, 50, 1],
    [100, 99, 1],
    [200, 99, 2],
    [100, 1, 99],
  ])('should discount %j RUB by %j percent to %j RUB', (amount, percent, expected) => {
    const originalAmount = amount;
    const discountPercent = percent;

    const result = calculateDiscountedAmount(originalAmount, discountPercent);

    expect(result).toBe(expected);
  });

  test.each([0, -1, NaN, Infinity])('should reject invalid amount %j', amount => {
    const discountPercent = 20;

    const action = (): number => calculateDiscountedAmount(amount, discountPercent);

    expect(action).toThrow('PROMO_CODE_INVALID_AMOUNT');
  });

  test.each([0, -1, 100, NaN, Infinity])('should reject invalid discount %j', percent => {
    const originalAmount = 100;

    const action = (): number => calculateDiscountedAmount(originalAmount, percent);

    expect(action).toThrow('PROMO_CODE_INVALID_DISCOUNT');
  });
});

describe('Active promo code lookup', () => {
  const findOne = jest.fn();
  const collection = jest.fn().mockReturnValue({ findOne });
  const db = { collection } as unknown as Db;
  let promoCode: PromoCode;

  beforeEach(() => {
    jest.clearAllMocks();
    promoCode = {
      _id: new ObjectId(),
      value: 'SALE20',
      discountPercent: 20,
      isActive: true,
      createdAt: NOW,
    };
    findOne.mockResolvedValue(promoCode);
  });

  test('should read a normalized code without modifying the database', async () => {
    const code = ' sale20 ';

    const result = await findActivePromoCode(db, code, NOW);

    expect(result).toEqual(promoCode);
    expect(collection).toHaveBeenCalledWith('promoCodes');
    expect(findOne).toHaveBeenCalledWith({ value: 'SALE20' });
  });

  test('should reject a code that does not exist', async () => {
    findOne.mockResolvedValue(null);

    const result = findActivePromoCode(db, 'UNKNOWN', NOW);

    await expect(result).rejects.toThrow('PROMO_CODE_NOT_FOUND');
  });

  test('should reject an inactive code', async () => {
    promoCode.isActive = false;

    const result = findActivePromoCode(db, 'SALE20', NOW);

    await expect(result).rejects.toThrow('PROMO_CODE_INACTIVE');
  });

  test('should reject a code before its start date', async () => {
    promoCode.validFrom = new Date(NOW.getTime() + 1);

    const result = findActivePromoCode(db, 'SALE20', NOW);

    await expect(result).rejects.toThrow('PROMO_CODE_NOT_STARTED');
  });

  test('should accept a code exactly at its start date', async () => {
    promoCode.validFrom = NOW;

    const result = await findActivePromoCode(db, 'SALE20', NOW);

    expect(result).toEqual(promoCode);
  });

  test('should reject an expired code', async () => {
    promoCode.validUntil = new Date(NOW.getTime() - 1);

    const result = findActivePromoCode(db, 'SALE20', NOW);

    await expect(result).rejects.toThrow('PROMO_CODE_EXPIRED');
  });

  test('should reject a code exactly at its expiration date', async () => {
    promoCode.validUntil = NOW;

    const result = findActivePromoCode(db, 'SALE20', NOW);

    await expect(result).rejects.toThrow('PROMO_CODE_EXPIRED');
  });

  test('should accept a code within its validity period', async () => {
    promoCode.validFrom = new Date(NOW.getTime() - 1);
    promoCode.validUntil = new Date(NOW.getTime() + 1);

    const result = await findActivePromoCode(db, 'SALE20', NOW);

    expect(result).toEqual(promoCode);
  });

  test('should reject malformed dates from manually created documents', async () => {
    promoCode.validUntil = new Date('invalid');

    const result = findActivePromoCode(db, 'SALE20', NOW);

    await expect(result).rejects.toThrow('PROMO_CODE_INVALID_DATES');
  });

  test('should reject a reversed validity period', async () => {
    promoCode.validFrom = new Date(NOW.getTime() + 1);
    promoCode.validUntil = new Date(NOW.getTime() - 1);

    const result = findActivePromoCode(db, 'SALE20', NOW);

    await expect(result).rejects.toThrow('PROMO_CODE_INVALID_DATES');
  });

  test('should reject an invalid discount from the database', async () => {
    promoCode.discountPercent = 100;

    const result = findActivePromoCode(db, 'SALE20', NOW);

    await expect(result).rejects.toThrow('PROMO_CODE_INVALID_DISCOUNT');
  });

  test('should preserve zero for later enforcement during reservation', async () => {
    promoCode.maxUses = 0;

    const result = await findActivePromoCode(db, 'SALE20', NOW);

    expect(result).toMatchObject({ maxUses: 0 });
  });

  test('should treat a string limit from the database as unlimited', async () => {
    const storedPromoCode = {
      ...promoCode,
      maxUses: '10',
    };

    findOne.mockResolvedValue(storedPromoCode);

    const result = await findActivePromoCode(db, 'SALE20', NOW);

    expect(result.maxUses).toBeUndefined();
    expect(storedPromoCode.maxUses).toBe('10');
  });
});
