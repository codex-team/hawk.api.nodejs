import { ObjectId } from 'mongodb';
import {
  applyDiscount,
  ensureActivePromoCode,
  getMaxUses,
  normalizePromoCode,
  PromoCode,
  PromoCodeDiscount
} from '../../../src/billing/promoCodes';

describe('Promo code normalization', () => {
  test('should trim whitespace and normalize case', () => {
    expect(normalizePromoCode('  sale20  ')).toBe('SALE20');
  });

  test.each(['', '  ', null, undefined, 20])('should reject invalid input: %j', code => {
    expect(() => normalizePromoCode(code as string)).toThrow('PROMO_CODE_INVALID');
  });
});

describe('Promo code usage limit', () => {
  test.each([0, 1, 10])('should preserve numeric limit %j', value => {
    expect(getMaxUses(value)).toBe(value);
  });

  test.each([undefined, null, -1, '10', '0', 'invalid', NaN, Infinity, false])(
    'should treat %j as unlimited without converting strings', value => {
      expect(getMaxUses(value)).toBeUndefined();
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
    [100, 71, 29],
  ])('should discount %j RUB by %j percent to %j RUB', (amount, percent, expected) => {
    expect(applyDiscount({
      type: 'percent',
      value: percent,
    }, amount)).toBe(expected);
  });

  test.each([
    [100, 20, 80],
    [100, 19.5, 81],
    [100.5, 20, 81],
    [100, 100, 1],
    [100, 200, 1],
    [0.5, 1, 1],
  ])('should discount %j RUB by a fixed %j RUB to %j RUB', (amount, value, expected) => {
    expect(applyDiscount({
      type: 'fixed',
      value,
    }, amount)).toBe(expected);
  });

  test.each([0, -1, NaN, Infinity])('should reject invalid amount %j', amount => {
    expect(() => applyDiscount({
      type: 'percent',
      value: 20,
    }, amount)).toThrow('PROMO_CODE_INVALID_AMOUNT');
  });

  test.each([0, -1, 100, 29.1, NaN, Infinity])('should reject invalid percent %j', value => {
    expect(() => applyDiscount({
      type: 'percent',
      value,
    }, 100)).toThrow('PROMO_CODE_INVALID');
  });

  test.each([0, -1, NaN, Infinity])('should reject invalid fixed discount %j', value => {
    expect(() => applyDiscount({
      type: 'fixed',
      value,
    }, 100)).toThrow('PROMO_CODE_INVALID');
  });

  test.each([undefined, null, {}, {
    type: 'other',
    value: 20,
  }, {
    type: 'percent',
    value: '20',
  } ])(
    'should reject malformed discount %j', discount => {
      expect(() => applyDiscount(discount as PromoCodeDiscount, 100)).toThrow('PROMO_CODE_INVALID');
    }
  );
});

describe('Active promo code validation', () => {
  let promoCode: PromoCode;
  let planId: ObjectId;

  beforeEach(() => {
    planId = new ObjectId();
    promoCode = {
      _id: new ObjectId(),
      code: 'SALE20',
      discount: {
        type: 'percent',
        value: 20,
      },
    };
  });

  test('should allow any plan when planIds is absent', () => {
    expect(() => ensureActivePromoCode(promoCode, planId)).not.toThrow();
  });

  test('should reject a code that does not exist', () => {
    expect(() => ensureActivePromoCode(null, planId)).toThrow('PROMO_CODE_INVALID');
  });

  test('should reject a disabled code', () => {
    promoCode.isDisabled = true;
    expect(() => ensureActivePromoCode(promoCode, planId)).toThrow('PROMO_CODE_INVALID');
  });

  test.each([undefined, false, null, 0, '', 'true'])('should allow isDisabled %j', isDisabled => {
    promoCode.isDisabled = isDisabled as boolean;
    expect(() => ensureActivePromoCode(promoCode, planId)).not.toThrow();
  });

  test('should allow a plan explicitly listed in planIds', () => {
    promoCode.planIds = [new ObjectId(), planId];
    expect(() => ensureActivePromoCode(promoCode, planId)).not.toThrow();
  });

  test.each([ [], [ new ObjectId() ], null, 'all', [ null ], [ 'not-a-plan-id' ] ])(
    'should reject ineligible or malformed planIds %j', planIds => {
      promoCode.planIds = planIds as ObjectId[];
      expect(() => ensureActivePromoCode(promoCode, planId)).toThrow('PROMO_CODE_INVALID');
    }
  );
});
