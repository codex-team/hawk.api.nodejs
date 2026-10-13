import type { Db } from 'mongodb';
import { MongoServerError, ObjectId } from 'mongodb';
import {
  PromoCodeRedemption,
  ReservePromoCodeInput,
  reservePromoCode
} from '../../../src/billing/promoCodes/redemptions';
import type { PromoCode } from '../../../src/billing/promoCodes';

const NOW = new Date('2026-10-13T12:00:00.000Z');
const RESERVATION_DEADLINE = new Date(NOW.getTime() + 30 * 60 * 1000);

describe('Promo code reservation', () => {
  const findPromoCode = jest.fn();
  const findRedemption = jest.fn();
  const countDocuments = jest.fn();
  const insertOne = jest.fn();
  const collection = jest.fn();
  const db = { collection } as unknown as Db;
  let promoCode: PromoCode;
  let input: ReservePromoCodeInput;
  let existingReservation: PromoCodeRedemption;

  beforeEach(() => {
    jest.resetAllMocks();
    promoCode = {
      _id: new ObjectId(),
      value: 'SALE20',
      discountPercent: 20,
      isActive: true,
      createdAt: NOW,
    };
    input = {
      promoCode: ' sale20 ',
      userId: new ObjectId(),
      workspaceId: new ObjectId(),
      tariffPlanId: new ObjectId(),
      originalAmount: 100,
    };
    existingReservation = {
      _id: new ObjectId(),
      promoCodeId: promoCode._id,
      userId: input.userId,
      workspaceId: input.workspaceId,
      tariffPlanId: input.tariffPlanId,
      status: 'reserved',
      originalAmount: 100,
      finalAmount: 80,
      discountPercent: 20,
      createdAt: NOW,
      expiresAt: RESERVATION_DEADLINE,
    };
    collection.mockImplementation((name: string) => {
      if (name === 'promoCodes') {
        return { findOne: findPromoCode };
      }

      if (name === 'promoCodeRedemptions') {
        return {
          findOne: findRedemption,
          countDocuments,
          insertOne,
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    });
    findPromoCode.mockResolvedValue(promoCode);
    findRedemption.mockResolvedValue(null);
    countDocuments.mockResolvedValue(0);
    insertOne.mockResolvedValue({ acknowledged: true });
  });

  test('should store the user, workspace, plan and discounted price in a reservation', async () => {
    const expectedPrice = 80;

    const result = await reservePromoCode(db, input, NOW);

    expect(result._id).toBeInstanceOf(ObjectId);
    expect(result).toMatchObject({
      promoCodeId: promoCode._id,
      userId: input.userId,
      workspaceId: input.workspaceId,
      tariffPlanId: input.tariffPlanId,
      status: 'reserved',
      originalAmount: 100,
      finalAmount: expectedPrice,
      discountPercent: 20,
      createdAt: NOW,
      expiresAt: RESERVATION_DEADLINE,
    });
    expect(findPromoCode).toHaveBeenCalledWith({ value: 'SALE20' });
    expect(insertOne).toHaveBeenCalledWith(result);
    expect(countDocuments).not.toHaveBeenCalled();
  });

  test('should not let a reservation outlive the promo code', async () => {
    promoCode.validUntil = new Date(NOW.getTime() + 10 * 60 * 1000);

    const result = await reservePromoCode(db, input, NOW);

    expect(result.expiresAt).toEqual(promoCode.validUntil);
  });

  test('should reuse an identical reservation without consuming quota again', async () => {
    promoCode.maxUses = 1;
    findRedemption.mockResolvedValue(existingReservation);
    countDocuments.mockResolvedValue(1);

    const result = await reservePromoCode(db, input, NOW);

    expect(result).toBe(existingReservation);
    expect(countDocuments).not.toHaveBeenCalled();
    expect(insertOne).not.toHaveBeenCalled();
  });

  test('should keep the stored price when reusing a reservation', async () => {
    promoCode.discountPercent = 30;
    findRedemption.mockResolvedValue(existingReservation);

    const result = await reservePromoCode(db, input, NOW);

    expect(result.finalAmount).toBe(80);
    expect(result.discountPercent).toBe(20);
    expect(insertOne).not.toHaveBeenCalled();
  });

  test('should reject a code already used by the same user in another workspace', async () => {
    existingReservation.workspaceId = new ObjectId();
    findRedemption.mockResolvedValue(existingReservation);

    const result = reservePromoCode(db, input, NOW);

    await expect(result).rejects.toThrow('PROMO_CODE_ALREADY_USED');
    expect(insertOne).not.toHaveBeenCalled();
  });

  test('should reject a code already used by another user in the same workspace', async () => {
    existingReservation.userId = new ObjectId();
    findRedemption.mockResolvedValue(existingReservation);

    const result = reservePromoCode(db, input, NOW);

    await expect(result).rejects.toThrow('PROMO_CODE_ALREADY_USED');
    expect(insertOne).not.toHaveBeenCalled();
  });

  test('should reject a successful use even for the same payment details', async () => {
    existingReservation.status = 'used';
    findRedemption.mockResolvedValue(existingReservation);

    const result = reservePromoCode(db, input, NOW);

    await expect(result).rejects.toThrow('PROMO_CODE_ALREADY_USED');
    expect(insertOne).not.toHaveBeenCalled();
  });

  test('should not reuse an expired reservation before it is released', async () => {
    existingReservation.expiresAt = NOW;
    findRedemption.mockResolvedValue(existingReservation);

    const result = reservePromoCode(db, input, NOW);

    await expect(result).rejects.toThrow('PROMO_CODE_ALREADY_USED');
    expect(insertOne).not.toHaveBeenCalled();
  });

  test('should not reuse a reservation already bound to a payment', async () => {
    existingReservation.transactionId = 'payment-123';
    findRedemption.mockResolvedValue(existingReservation);

    const result = reservePromoCode(db, input, NOW);

    await expect(result).rejects.toThrow('PROMO_CODE_ALREADY_USED');
    expect(insertOne).not.toHaveBeenCalled();
  });

  test('should not reuse a reservation for another plan', async () => {
    existingReservation.tariffPlanId = new ObjectId();
    findRedemption.mockResolvedValue(existingReservation);

    const result = reservePromoCode(db, input, NOW);

    await expect(result).rejects.toThrow('PROMO_CODE_ALREADY_USED');
    expect(insertOne).not.toHaveBeenCalled();
  });

  test('should not reuse a reservation for another original price', async () => {
    existingReservation.originalAmount = 200;
    findRedemption.mockResolvedValue(existingReservation);

    const result = reservePromoCode(db, input, NOW);

    await expect(result).rejects.toThrow('PROMO_CODE_ALREADY_USED');
    expect(insertOne).not.toHaveBeenCalled();
  });

  test('should count reserved and used records before reserving the last available use', async () => {
    promoCode.maxUses = 2;
    countDocuments.mockResolvedValue(1);

    const result = await reservePromoCode(db, input, NOW);

    expect(result.status).toBe('reserved');
    expect(countDocuments).toHaveBeenCalledWith({
      promoCodeId: promoCode._id,
      status: { $in: ['reserved', 'used'] },
    });
    expect(insertOne).toHaveBeenCalledTimes(1);
    expect(promoCode.maxUses).toBe(2);
  });

  test.each([0, 1, 2])('should reject a reservation when limit %j is exhausted', async maxUses => {
    promoCode.maxUses = maxUses;
    countDocuments.mockResolvedValue(maxUses);

    const result = reservePromoCode(db, input, NOW);

    await expect(result).rejects.toThrow('PROMO_CODE_LIMIT_REACHED');
    expect(insertOne).not.toHaveBeenCalled();
  });

  test.each(['10', -1, null, undefined, NaN, Infinity])(
    'should allow unlimited use when maxUses is %j', async maxUses => {
      findPromoCode.mockResolvedValue({
        ...promoCode,
        maxUses,
      });

      const result = await reservePromoCode(db, input, NOW);

      expect(result.status).toBe('reserved');
      expect(countDocuments).not.toHaveBeenCalled();
      expect(insertOne).toHaveBeenCalledTimes(1);
    }
  );

  test('should reuse the same reservation created by a concurrent request', async () => {
    findRedemption.mockResolvedValueOnce(null).mockResolvedValueOnce(existingReservation);
    insertOne.mockRejectedValue(new MongoServerError({
      message: 'Duplicate key',
      code: 11000,
    }));

    const result = await reservePromoCode(db, input, NOW);

    expect(result).toBe(existingReservation);
    expect(findRedemption).toHaveBeenCalledTimes(2);
  });

  test('should reject a concurrent duplicate use by another user', async () => {
    existingReservation.userId = new ObjectId();
    findRedemption.mockResolvedValueOnce(null).mockResolvedValueOnce(existingReservation);
    insertOne.mockRejectedValue(new MongoServerError({
      message: 'Duplicate key',
      code: 11000,
    }));

    const result = reservePromoCode(db, input, NOW);

    await expect(result).rejects.toThrow('PROMO_CODE_ALREADY_USED');
  });

  test('should propagate a database write failure', async () => {
    const error = new Error('Database unavailable');

    insertOne.mockRejectedValue(error);

    const result = reservePromoCode(db, input, NOW);

    await expect(result).rejects.toBe(error);
  });

  test('should not reserve an inactive promo code', async () => {
    promoCode.isActive = false;

    const result = reservePromoCode(db, input, NOW);

    await expect(result).rejects.toThrow('PROMO_CODE_INACTIVE');
    expect(insertOne).not.toHaveBeenCalled();
  });
});
