import type { Db } from 'mongodb';
import { MongoServerError, ObjectId } from 'mongodb';
import { preparePromoCode, recordPromoCodeUsage, validatePromoPayment } from '../../../src/billing/promoCodes/redemptions';
import type { PromoCodeInput, PromoPayment, PromoCodeRedemption } from '../../../src/billing/promoCodes/redemptions';
import type { PromoCode } from '../../../src/billing/promoCodes';

describe('Promo code usage', () => {
  const findPromoCode = jest.fn();
  const findRedemption = jest.fn();
  const countDocuments = jest.fn();
  const insertOne = jest.fn();
  const collection = jest.fn();
  const db = { collection } as unknown as Db;
  let promoCode: PromoCode;
  let input: PromoCodeInput;
  let payment: PromoPayment;
  let existingUse: PromoCodeRedemption;

  beforeEach(() => {
    jest.resetAllMocks();
    promoCode = {
      _id: new ObjectId(),
      value: 'SALE20',
      discountPercent: 20,
    };
    input = {
      promoCode: ' sale20 ',
      userId: new ObjectId(),
      workspaceId: new ObjectId(),
      tariffPlanId: new ObjectId(),
      originalAmount: 100,
    };
    payment = {
      promoCodeId: promoCode._id.toString(),
      promoPaymentId: new ObjectId().toString(),
      userId: input.userId.toString(),
      workspaceId: input.workspaceId.toString(),
      tariffPlanId: input.tariffPlanId.toString(),
      originalAmount: 100,
      discountPercent: 20,
      paymentAmount: 80,
      transactionId: 'payment-123',
      amount: 80,
      currency: 'RUB',
    };
    existingUse = {
      _id: new ObjectId(),
      promoCodeId: promoCode._id,
      userId: input.userId,
      workspaceId: input.workspaceId,
      tariffPlanId: input.tariffPlanId,
      transactionId: payment.transactionId,
      originalAmount: 100,
      finalAmount: 80,
      discountPercent: 20,
    };
    collection.mockImplementation((name: string) => {
      if (name === 'promoCodes') {
        return { findOne: findPromoCode };
      }

      return {
        findOne: findRedemption,
        countDocuments,
        insertOne,
      };
    });
    findPromoCode.mockResolvedValue(promoCode);
    findRedemption.mockResolvedValue(null);
    countDocuments.mockResolvedValue(0);
    insertOne.mockResolvedValue({ acknowledged: true });
  });

  test('should prepare a discounted quote without creating a usage record', async () => {
    const expectedAmount = 80;

    const result = await preparePromoCode(db, input);

    expect(result).toEqual({
      promoCodeId: promoCode._id,
      originalAmount: 100,
      finalAmount: expectedAmount,
      discountPercent: 20,
    });
    expect(insertOne).not.toHaveBeenCalled();
  });

  test('should allow repeated preparation while no successful use exists', async () => {
    const first = await preparePromoCode(db, input);

    const second = await preparePromoCode(db, input);

    expect(second).toEqual(first);
    expect(insertOne).not.toHaveBeenCalled();
  });

  test.each(['userId', 'workspaceId'] as const)('should reject successful reuse by the same %s', async field => {
    const otherField = field === 'userId' ? 'workspaceId' : 'userId';

    existingUse[otherField] = new ObjectId();
    findRedemption.mockResolvedValue(existingUse);

    const result = preparePromoCode(db, input);

    await expect(result).rejects.toThrow('PROMO_CODE_ALREADY_USED');
    expect(insertOne).not.toHaveBeenCalled();
  });

  test.each([0, 1])('should reject an exhausted limit of %j', async maxUses => {
    promoCode.maxUses = maxUses;
    countDocuments.mockResolvedValue(maxUses);

    const result = preparePromoCode(db, input);

    await expect(result).rejects.toThrow('PROMO_CODE_INVALID');
    expect(countDocuments).toHaveBeenCalledWith({ promoCodeId: promoCode._id });
  });

  test.each([undefined, -1, '2'])('should ignore invalid or missing limit %j', async maxUses => {
    findPromoCode.mockResolvedValue({
      ...promoCode,
      maxUses,
    });

    const result = await preparePromoCode(db, input);

    expect(result.finalAmount).toBe(80);
    expect(countDocuments).not.toHaveBeenCalled();
  });

  test('should reject a plan outside the allowed list', async () => {
    promoCode.planIds = [ new ObjectId() ];

    const result = preparePromoCode(db, input);

    await expect(result).rejects.toThrow('PROMO_CODE_INVALID');
    expect(insertOne).not.toHaveBeenCalled();
  });

  test('should record only successful usage without status or expiry fields', async () => {
    const callback = payment;

    await recordPromoCodeUsage(db, callback);

    expect(insertOne).toHaveBeenCalledWith({
      ...existingUse,
      _id: expect.any(ObjectId),
    });
    const stored = insertOne.mock.calls[0][0];

    expect(stored).not.toHaveProperty('status');
    expect(stored).not.toHaveProperty('expiresAt');
  });

  test('should not create another row when the same successful callback is repeated', async () => {
    findRedemption.mockResolvedValue(existingUse);
    insertOne.mockRejectedValue(new MongoServerError({
      code: 11000,
      message: 'Duplicate key',
    }));

    const result = recordPromoCodeUsage(db, payment);

    await expect(result).resolves.toBeUndefined();
  });

  test('should not lose the paid plan when a parallel successful payment uses the same code', async () => {
    existingUse.transactionId = 'another-payment';
    findRedemption.mockResolvedValue(existingUse);
    insertOne.mockRejectedValue(new MongoServerError({
      code: 11000,
      message: 'Duplicate key',
    }));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      const result = recordPromoCodeUsage(db, payment);

      await expect(result).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  test('should propagate a database failure so the callback can be retried', async () => {
    const error = new Error('Database unavailable');

    insertOne.mockRejectedValue(error);

    const result = recordPromoCodeUsage(db, payment);

    await expect(result).rejects.toBe(error);
  });

  test.each([1, 81, NaN])('should reject a callback with a changed amount %j', amount => {
    payment.amount = amount;

    /**
     * Validate the changed callback amount to exercise payment validation.
     *
     * @returns Nothing if validation succeeds.
     */
    const action = (): void => validatePromoPayment(payment);

    expect(action).toThrow('PROMO_CODE_WRONG_AMOUNT');
    expect(insertOne).not.toHaveBeenCalled();
  });
});
