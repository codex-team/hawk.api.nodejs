import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { UserInputError } from 'apollo-server-express';
import type { PromoCodeRedemption } from './redemptions';

export interface PromoPayment {
  promoCodeRedemptionId: string;
  userId: string;
  workspaceId: string;
  tariffPlanId: string;
  paymentAmount: number;
  transactionId: string;
  amount: number;
  currency: string;
}

/**
 * Validate callback fields before querying MongoDB, including already-deleted retries.
 *
 * @param payment - signed payment identity and provider callback fields
 */
function validatePayment(payment: PromoPayment): void {
  const ids = [payment.promoCodeRedemptionId, payment.userId, payment.workspaceId, payment.tariffPlanId];

  if (ids.some(id => typeof id !== 'string' || !ObjectId.isValid(id)) ||
    typeof payment.transactionId !== 'string' || !payment.transactionId.trim() ||
    payment.currency !== 'RUB') {
    throw new UserInputError('PROMO_CODE_INVALID_PAYMENT');
  }

  if (!Number.isFinite(payment.paymentAmount) || payment.paymentAmount < 1 ||
    !Number.isFinite(payment.amount) || payment.amount < 1 ||
    payment.paymentAmount !== payment.amount) {
    throw new UserInputError('PROMO_CODE_WRONG_AMOUNT');
  }
}

/**
 * Load and validate a reservation without requiring it to be bound yet.
 *
 * @param db - accounts database
 * @param payment - signed payment identity and provider callback fields
 * @returns matching reservation, or null if it has been deleted
 */
async function loadReservation(db: Db, payment: PromoPayment): Promise<PromoCodeRedemption | null> {
  validatePayment(payment);

  const reservation = await db.collection<PromoCodeRedemption>('promoCodeRedemptions').findOne({
    _id: new ObjectId(payment.promoCodeRedemptionId),
  });

  if (!reservation) {
    return null;
  }

  if (!reservation.userId.equals(new ObjectId(payment.userId)) ||
    !reservation.workspaceId.equals(new ObjectId(payment.workspaceId)) ||
    !reservation.tariffPlanId.equals(new ObjectId(payment.tariffPlanId)) ||
    (reservation.status !== 'reserved' && reservation.status !== 'used')) {
    throw new UserInputError('PROMO_CODE_INVALID_RESERVATION');
  }

  if (!Number.isFinite(reservation.finalAmount) || reservation.finalAmount < 1 ||
    reservation.finalAmount !== payment.paymentAmount) {
    throw new UserInputError('PROMO_CODE_WRONG_AMOUNT');
  }

  if (reservation.transactionId !== undefined && reservation.transactionId !== payment.transactionId) {
    throw new UserInputError('PROMO_CODE_RESERVED_FOR_ANOTHER_PAYMENT');
  }

  return reservation;
}

/**
 * Validate a quote before creating a pending operation, without binding the reservation.
 *
 * @param db - accounts database
 * @param payment - signed payment identity and provider callback fields
 * @param now - quote validation time
 * @returns unexpired reservation or an already-used duplicate for the same transaction
 */
export async function getPromoCodeQuote(
  db: Db,
  payment: PromoPayment,
  now = new Date()
): Promise<PromoCodeRedemption> {
  const reservation = await loadReservation(db, payment);

  if (!reservation) {
    throw new UserInputError('PROMO_CODE_INVALID_RESERVATION');
  }

  if (reservation.status === 'used' && reservation.transactionId === payment.transactionId) {
    return reservation;
  }

  if (reservation.status !== 'reserved' || !(reservation.expiresAt instanceof Date) ||
    !(reservation.expiresAt > now)) {
    throw new UserInputError('PROMO_CODE_INVALID_RESERVATION');
  }

  return reservation;
}

/**
 * Require the exact bound transaction, but allow late callbacks and used-record retries.
 *
 * @param db - accounts database
 * @param payment - signed payment identity and provider callback fields
 * @returns matching bound reservation
 */
export async function getPromoCodeReservation(db: Db, payment: PromoPayment): Promise<PromoCodeRedemption> {
  const reservation = await loadReservation(db, payment);

  if (!reservation || reservation.transactionId !== payment.transactionId) {
    throw new UserInputError('PROMO_CODE_INVALID_RESERVATION');
  }

  return reservation;
}

/**
 * Bind an unexpired reservation atomically; a used record is returned only for the same transaction.
 *
 * @param db - accounts database
 * @param payment - signed payment identity and provider callback fields
 * @param now - binding time
 * @returns bound reservation, including an already-used duplicate
 */
export async function bindPromoCodeReservation(
  db: Db,
  payment: PromoPayment,
  now = new Date()
): Promise<PromoCodeRedemption> {
  const reservation = await getPromoCodeQuote(db, payment, now);

  if (reservation.status === 'used') {
    return reservation;
  }

  const boundReservation = await db.collection<PromoCodeRedemption>('promoCodeRedemptions').findOneAndUpdate({
    _id: reservation._id,
    status: 'reserved',
    expiresAt: { $gt: now },
    $or: [
      { transactionId: { $exists: false } },
      { transactionId: payment.transactionId },
    ],
  }, {
    $set: { transactionId: payment.transactionId },
  }, {
    includeResultMetadata: false,
    returnDocument: 'after',
  });

  if (boundReservation) {
    return boundReservation;
  }

  const currentReservation = await getPromoCodeReservation(db, payment);

  if (currentReservation.status === 'used') {
    return currentReservation;
  }

  throw new UserInputError('PROMO_CODE_INVALID_RESERVATION');
}

/**
 * Consume a bound reservation once, even when completion callbacks race.
 *
 * @param db - accounts database
 * @param payment - signed payment identity and provider callback fields
 * @param now - successful payment time
 * @returns true only for the callback that changes reserved to used
 */
export async function completePromoCodeReservation(db: Db, payment: PromoPayment, now = new Date()): Promise<boolean> {
  const reservation = await getPromoCodeReservation(db, payment);

  if (reservation.status === 'used') {
    return false;
  }

  const result = await db.collection<PromoCodeRedemption>('promoCodeRedemptions').updateOne({
    _id: reservation._id,
    status: 'reserved',
    transactionId: payment.transactionId,
  }, {
    $set: {
      status: 'used',
      usedAt: now,
    },
    $unset: { expiresAt: '' },
  });

  if (result.modifiedCount === 1) {
    return true;
  }

  const currentReservation = await getPromoCodeReservation(db, payment);

  if (currentReservation.status === 'used') {
    return false;
  }

  throw new UserInputError('PROMO_CODE_INVALID_RESERVATION');
}

/**
 * Release only a reserved record bound to this transaction; missing and used retries are no-ops.
 *
 * @param db - accounts database
 * @param payment - signed payment identity and provider callback fields
 * @returns whether the reservation was deleted
 */
export async function releasePromoCodeReservation(db: Db, payment: PromoPayment): Promise<boolean> {
  const reservation = await loadReservation(db, payment);

  if (!reservation) {
    return false;
  }

  if (reservation.transactionId !== payment.transactionId) {
    throw new UserInputError('PROMO_CODE_INVALID_RESERVATION');
  }

  if (reservation.status === 'used') {
    return false;
  }

  const result = await db.collection<PromoCodeRedemption>('promoCodeRedemptions').deleteOne({
    _id: reservation._id,
    status: 'reserved',
    transactionId: payment.transactionId,
  });

  return result.deletedCount === 1;
}

/**
 * Free expired, unbound reservations only; provider-bound records must await a payment outcome.
 *
 * @param db - accounts database
 * @param promoCodeId - code whose expired reservations should be released
 * @param now - cleanup time, including the expiry boundary
 * @returns number of deleted reservations
 */
export async function releaseExpiredPromoCodeReservations(db: Db, promoCodeId: ObjectId, now = new Date()): Promise<number> {
  const result = await db.collection<PromoCodeRedemption>('promoCodeRedemptions').deleteMany({
    promoCodeId,
    status: 'reserved',
    expiresAt: { $lte: now },
    transactionId: { $exists: false },
  });

  return result.deletedCount;
}
