import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { UserInputError } from 'apollo-server-express';
import {
  bindPromoCodeReservation,
  getPromoCodeQuote,
  getPromoCodeReservation,
  completePromoCodeReservation,
  releasePromoCodeReservation,
  releaseExpiredPromoCodeReservations
} from '../../../src/billing/promoCodes/lifecycle';
import type { PromoPayment } from '../../../src/billing/promoCodes/lifecycle';
import type { PromoCodeRedemption } from '../../../src/billing/promoCodes/redemptions';

const NOW = new Date('2026-10-13T12:00:00.000Z');
const DEADLINE = new Date(NOW.getTime() + 30 * 60 * 1000);

describe('Promo code reservation lifecycle', () => {
  const findOne = jest.fn();
  const findOneAndUpdate = jest.fn();
  const updateOne = jest.fn();
  const deleteOne = jest.fn();
  const deleteMany = jest.fn();
  const collection = jest.fn();
  const db = { collection } as unknown as Db;
  let reservation: PromoCodeRedemption;
  let payment: PromoPayment;

  beforeEach(() => {
    jest.resetAllMocks();
    reservation = {
      _id: new ObjectId(),
      promoCodeId: new ObjectId(),
      userId: new ObjectId(),
      workspaceId: new ObjectId(),
      tariffPlanId: new ObjectId(),
      status: 'reserved',
      originalAmount: 100,
      finalAmount: 80,
      discountPercent: 20,
      createdAt: NOW,
      expiresAt: DEADLINE,
      transactionId: 'payment-123',
    };
    payment = {
      promoCodeRedemptionId: reservation._id.toHexString(),
      userId: reservation.userId.toHexString(),
      workspaceId: reservation.workspaceId.toHexString(),
      tariffPlanId: reservation.tariffPlanId.toHexString(),
      paymentAmount: 80,
      transactionId: 'payment-123',
      amount: 80,
      currency: 'RUB',
    };
    collection.mockReturnValue({
      findOne,
      findOneAndUpdate,
      updateOne,
      deleteOne,
      deleteMany,
    });
    findOne.mockResolvedValue(reservation);
    findOneAndUpdate.mockResolvedValue(reservation);
    updateOne.mockResolvedValue({ modifiedCount: 1 });
    deleteOne.mockResolvedValue({ deletedCount: 1 });
    deleteMany.mockResolvedValue({ deletedCount: 2 });
  });

  test.each([
    ['invalid redemption id', { promoCodeRedemptionId: 'g'.repeat(24) } ],
    ['null user id', { userId: null } ],
    ['missing workspace id', { workspaceId: undefined } ],
    ['non-string tariff id', { tariffPlanId: 123 } ],
    ['wrong currency', { currency: 'USD' } ],
    ['blank transaction id', { transactionId: '   ' } ],
  ] as const)('should reject %s before querying MongoDB', async (_, fields) => {
    Object.assign(payment, fields);

    const result = getPromoCodeReservation(db, payment);

    await expect(result).rejects.toThrow('PROMO_CODE_INVALID_PAYMENT');
    expect(collection).not.toHaveBeenCalled();
  });

  test.each([
    ['changed signed amount', 81, 80, 80],
    ['changed callback amount', 80, 81, 80],
    ['sub-ruble payment', 0.99, 0.99, 0.99],
    ['non-finite callback amount', 80, NaN, 80],
    ['changed stored amount', 80, 80, 79],
    ['non-finite stored amount', 80, 80, Infinity],
  ] as const)('should reject %s without writing', async (_, signedAmount, callbackAmount, finalAmount) => {
    payment.paymentAmount = signedAmount;
    payment.amount = callbackAmount;
    reservation.finalAmount = finalAmount;

    const result = getPromoCodeReservation(db, payment);

    await expect(result).rejects.toThrow('PROMO_CODE_WRONG_AMOUNT');

    expect(findOneAndUpdate).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
    expect(deleteOne).not.toHaveBeenCalled();
  });

  test.each(['userId', 'workspaceId', 'tariffPlanId'] as const)(
    'should reject a reservation belonging to another %s', async field => {
      payment[field] = new ObjectId().toHexString();

      const result = getPromoCodeReservation(db, payment);

      await expect(result).rejects.toThrow('PROMO_CODE_INVALID_RESERVATION');
    }
  );

  test.each(['missing', 'unbound', 'unsupported status'])(
    'should reject a %s reservation with a UserInputError', async state => {
      findOne.mockResolvedValue(state === 'missing' ? null : {
        ...reservation,
        transactionId: state === 'unbound' ? undefined : payment.transactionId,
        status: state === 'unsupported status' ? 'released' : 'reserved',
      });

      const result = getPromoCodeReservation(db, payment);

      await expect(result).rejects.toBeInstanceOf(UserInputError);
      await expect(result).rejects.toThrow('PROMO_CODE_INVALID_RESERVATION');
    }
  );

  test('should load an exact one-ruble payment by ObjectId for a late bound callback', async () => {
    reservation.finalAmount = payment.paymentAmount = payment.amount = 1;
    reservation.expiresAt = NOW;
    payment.userId = payment.userId.toUpperCase();

    const result = await getPromoCodeReservation(db, payment);

    expect(result).toBe(reservation);
    expect(collection).toHaveBeenCalledWith('promoCodeRedemptions');
    expect(findOne).toHaveBeenCalledWith({ _id: reservation._id });
  });

  test('should require the exact bound transaction without trimming', async () => {
    payment.transactionId = ' payment-123 ';

    const result = getPromoCodeReservation(db, payment);

    await expect(result).rejects.toThrow('PROMO_CODE_RESERVED_FOR_ANOTHER_PAYMENT');
  });

  test.each(['unbound', 'used'] as const)('should quote a matching %s reservation without writes', async state => {
    if (state === 'unbound') {
      delete reservation.transactionId;
    } else {
      reservation.status = 'used';
      delete reservation.expiresAt;
    }

    const result = await getPromoCodeQuote(db, payment, NOW);

    expect(result).toBe(reservation);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
    expect(deleteOne).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  test.each([NOW, undefined])('should reject unbound quote expiry %j', async expiresAt => {
    delete reservation.transactionId;
    reservation.expiresAt = expiresAt;

    const result = getPromoCodeQuote(db, payment, NOW);

    await expect(result).rejects.toThrow('PROMO_CODE_INVALID_RESERVATION');
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('should atomically bind an unexpired reservation and retry without extending expiry', async () => {
    delete reservation.transactionId;
    const bound = {
      ...reservation,
      transactionId: payment.transactionId,
    };

    findOne.mockResolvedValueOnce(reservation).mockResolvedValue(bound);
    findOneAndUpdate.mockResolvedValue(bound);

    const first = await bindPromoCodeReservation(db, payment, NOW);
    const retry = await bindPromoCodeReservation(db, payment, NOW);

    expect(first).toBe(bound);
    expect(retry).toBe(bound);
    expect(bound.expiresAt).toBe(DEADLINE);
    expect(findOne).toHaveBeenCalledTimes(2);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(findOneAndUpdate).toHaveBeenCalledWith({
      _id: reservation._id,
      status: 'reserved',
      expiresAt: { $gt: NOW },
      $or: [ { transactionId: { $exists: false } }, { transactionId: payment.transactionId } ],
    }, {
      $set: { transactionId: payment.transactionId },
    }, {
      includeResultMetadata: false,
      returnDocument: 'after',
    });
  });

  test('should never rebind a used reservation from another transaction', async () => {
    reservation.status = 'used';
    reservation.transactionId = 'another-payment';

    const result = bindPromoCodeReservation(db, payment, NOW);

    await expect(result).rejects.toThrow('PROMO_CODE_RESERVED_FOR_ANOTHER_PAYMENT');
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  test.each([
    ['reserved', 'PROMO_CODE_INVALID_RESERVATION'],
    ['deleted', 'PROMO_CODE_INVALID_RESERVATION'],
    ['foreign transaction', 'PROMO_CODE_RESERVED_FOR_ANOTHER_PAYMENT'],
  ])('should reject a conditional bind miss with a %s record', async (state, error) => {
    const current = state === 'deleted' ? null : {
      ...reservation,
      transactionId: state === 'foreign transaction' ? 'another-payment' : payment.transactionId,
    };

    delete reservation.transactionId;
    findOne.mockResolvedValueOnce(reservation).mockResolvedValueOnce(current);
    findOneAndUpdate.mockResolvedValue(null);

    const result = bindPromoCodeReservation(db, payment, NOW);

    await expect(result).rejects.toThrow(error);
    expect(findOne).toHaveBeenCalledTimes(2);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  test('should return a matching reservation completed concurrently during binding', async () => {
    const used = {
      ...reservation,
      status: 'used',
    };

    findOne.mockResolvedValueOnce(reservation).mockResolvedValueOnce(used);
    findOneAndUpdate.mockResolvedValue(null);

    const result = await bindPromoCodeReservation(db, payment, NOW);

    expect(result).toBe(used);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  test('should atomically complete a late bound payment and remove its expiry', async () => {
    reservation.expiresAt = NOW;

    const result = await completePromoCodeReservation(db, payment, NOW);

    expect(result).toBe(true);
    expect(updateOne).toHaveBeenCalledWith({
      _id: reservation._id,
      status: 'reserved',
      transactionId: payment.transactionId,
    }, {
      $set: {
        status: 'used',
        usedAt: NOW,
      },
      $unset: { expiresAt: '' },
    });
  });

  test('should return false for an already completed matching payment', async () => {
    reservation.status = 'used';
    delete reservation.expiresAt;

    const result = await completePromoCodeReservation(db, payment, NOW);

    expect(result).toBe(false);
    expect(updateOne).not.toHaveBeenCalled();
  });

  test('should complete only once when matching callbacks race', async () => {
    findOne.mockResolvedValueOnce({ ...reservation }).mockResolvedValueOnce({ ...reservation })
      .mockResolvedValue({
        ...reservation,
        status: 'used',
      });
    updateOne.mockResolvedValueOnce({ modifiedCount: 1 }).mockResolvedValueOnce({ modifiedCount: 0 });

    const results = await Promise.all([
      completePromoCodeReservation(db, payment, NOW),
      completePromoCodeReservation(db, payment, NOW),
    ]);

    expect(results).toEqual([true, false]);
    expect(updateOne).toHaveBeenCalledTimes(2);
    expect(findOne).toHaveBeenCalledTimes(3);
  });

  test.each([
    ['reserved', 'PROMO_CODE_INVALID_RESERVATION'],
    ['used by another transaction', 'PROMO_CODE_RESERVED_FOR_ANOTHER_PAYMENT'],
  ])('should reject a conditional completion miss with a record %s', async (state, error) => {
    findOne.mockResolvedValueOnce(reservation).mockResolvedValueOnce({
      ...reservation,
      status: state === 'reserved' ? 'reserved' : 'used',
      transactionId: state === 'reserved' ? payment.transactionId : 'another-payment',
    });
    updateOne.mockResolvedValue({ modifiedCount: 0 });

    const result = completePromoCodeReservation(db, payment, NOW);

    await expect(result).rejects.toThrow(error);
    expect(updateOne).toHaveBeenCalledTimes(1);
  });

  test.each(['missing', 'used'])('should safely release a %s reservation without deleting', async state => {
    findOne.mockResolvedValue(state === 'missing' ? null : {
      ...reservation,
      status: 'used',
    });

    const result = await releasePromoCodeReservation(db, payment);

    expect(result).toBe(false);
    expect(deleteOne).not.toHaveBeenCalled();
  });

  test.each([1, 0])('should conditionally release a bound reservation with deletedCount %i', async deletedCount => {
    reservation.expiresAt = NOW;
    deleteOne.mockResolvedValue({ deletedCount });

    const result = await releasePromoCodeReservation(db, payment);

    expect(result).toBe(deletedCount === 1);
    expect(deleteOne).toHaveBeenCalledWith({
      _id: reservation._id,
      status: 'reserved',
      transactionId: payment.transactionId,
    });
  });

  test('should delete only expired unbound reserved records for the requested code', async () => {
    const promoCodeId = reservation.promoCodeId;

    const result = await releaseExpiredPromoCodeReservations(db, promoCodeId, NOW);

    expect(result).toBe(2);
    expect(deleteMany).toHaveBeenCalledWith({
      promoCodeId,
      status: 'reserved',
      expiresAt: { $lte: NOW },
      transactionId: { $exists: false },
    });
  });
});
