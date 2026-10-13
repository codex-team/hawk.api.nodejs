import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import {
  calculateDiscountedAmount,
  findActivePromoCode,
  getMaxUses,
  normalizePromoCode,
  PromoCode
} from '../../../src/billing/promoCodes';

const NOW = new Date('2026-10-13T12:00:00.000Z');

describe('Promo code normalization', () => {
  test('should trim whitespace and normalize case', () => {
    const code = '  sale20  ';

    const result = normalizePromoCode(code);

    expect(result).toBe('SALE20');
  });

  test.each(['', '  '])('should reject an empty code: %j', code => {
    const action = (): string => normalizePromoCode(code);

    expect(action).toThrow('PROMO_CODE_INVALID');
  });
});

describe('Promo code usage limit', () => {
  test.each([0, 1, 10])('should preserve numeric limit %j', value => {
    const result = getMaxUses(value);

    expect(result).toBe(value);
  });

  test.each([undefined, null, -1, '10', '0', 'invalid', NaN, Infinity, false])(
    'should treat %j as unlimited without converting strings', value => {
      const result = getMaxUses(value);

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
    const result = calculateDiscountedAmount(amount, percent);

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

    expect(action).toThrow('PROMO_CODE_INVALID');
  });
});

describe('Active promo code lookup', () => {
  const findOne = jest.fn();
  const collection = jest.fn().mockReturnValue({ findOne });
  const db = { collection } as unknown as Db;
  let promoCode: PromoCode;
  let planId: ObjectId;

  beforeEach(() => {
    jest.clearAllMocks();
    planId = new ObjectId();
    promoCode = {
      _id: new ObjectId(),
      value: 'SALE20',
      discountPercent: 20,
      isActive: true,
      createdAt: NOW,
    };
    findOne.mockResolvedValue(promoCode);
  });

  test('should allow any plan when planIds is absent', async () => {
    const code = ' sale20 ';

    const result = await findActivePromoCode(db, code, planId);

    expect(result).toEqual(promoCode);
    expect(collection).toHaveBeenCalledWith('promoCodes');
    expect(findOne).toHaveBeenCalledWith({ value: 'SALE20' });
  });

  test('should reject a code that does not exist', async () => {
    findOne.mockResolvedValue(null);

    const result = findActivePromoCode(db, 'UNKNOWN', planId);

    await expect(result).rejects.toThrow('PROMO_CODE_INVALID');
  });

  test('should reject an inactive code', async () => {
    promoCode.isActive = false;

    const result = findActivePromoCode(db, 'SALE20', planId);

    await expect(result).rejects.toThrow('PROMO_CODE_INVALID');
  });

  test('should allow a plan explicitly listed in planIds', async () => {
    promoCode.planIds = [new ObjectId(), planId];

    const result = await findActivePromoCode(db, 'SALE20', planId);

    expect(result).toEqual(promoCode);
  });

  test('should reject a plan not listed in planIds', async () => {
    promoCode.planIds = [ new ObjectId() ];

    const result = findActivePromoCode(db, 'SALE20', planId);

    await expect(result).rejects.toThrow('PROMO_CODE_INVALID');
  });

  test('should allow no plans when planIds is empty', async () => {
    promoCode.planIds = [];

    const result = findActivePromoCode(db, 'SALE20', planId);

    await expect(result).rejects.toThrow('PROMO_CODE_INVALID');
  });

  test.each([
    { planIds: null },
    { planIds: 'all' },
    { planIds: [ null ] },
    { planIds: [ 'not-a-plan-id' ] },
  ])('should reject malformed planIds %j', async ({ planIds }) => {
    findOne.mockResolvedValue({
      ...promoCode,
      planIds,
    });

    const result = findActivePromoCode(db, 'SALE20', planId);

    await expect(result).rejects.toThrow('PROMO_CODE_INVALID');
  });

  test('should reject an invalid discount from the database', async () => {
    promoCode.discountPercent = 100;

    const result = findActivePromoCode(db, 'SALE20', planId);

    await expect(result).rejects.toThrow('PROMO_CODE_INVALID');
  });

  test('should preserve zero for later enforcement during reservation', async () => {
    promoCode.maxUses = 0;

    const result = await findActivePromoCode(db, 'SALE20', planId);

    expect(result).toMatchObject({ maxUses: 0 });
  });

  test('should treat a string limit from the database as unlimited', async () => {
    const storedPromoCode = {
      ...promoCode,
      maxUses: '10',
    };

    findOne.mockResolvedValue(storedPromoCode);

    const result = await findActivePromoCode(db, 'SALE20', planId);

    expect(result.maxUses).toBeUndefined();
    expect(storedPromoCode.maxUses).toBe('10');
  });
});
