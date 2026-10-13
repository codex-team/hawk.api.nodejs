import type { Db } from 'mongodb';
import { MongoServerError, ObjectId } from 'mongodb';
import { UserInputError } from 'apollo-server-express';
import { calculateDiscountedAmount, findActivePromoCode } from './index';
import { releaseExpiredPromoCodeReservations } from './lifecycle';

const RESERVATION_DURATION_MS = 30 * 60 * 1000;

export interface PromoCodeRedemption {
  _id: ObjectId;
  promoCodeId: ObjectId;
  userId: ObjectId;
  workspaceId: ObjectId;
  tariffPlanId: ObjectId;
  status: 'reserved' | 'used';
  originalAmount: number;
  finalAmount: number;
  discountPercent: number;
  createdAt: Date;
  expiresAt?: Date;
  transactionId?: string;
  usedAt?: Date;
}

export interface ReservePromoCodeInput {
  promoCode: string;
  userId: ObjectId;
  workspaceId: ObjectId;
  tariffPlanId: ObjectId;
  originalAmount: number;
}

/**
 * Reuse only an unexpired reservation for the exact same payment preparation.
 * A reservation bound to a provider transaction must not start another payment.
 *
 * @param reservation - existing use by this user or workspace
 * @param input - requested payment
 * @param now - reservation time
 * @returns existing reservation, or throws if reuse is not allowed
 */
function reuseReservation(
  reservation: PromoCodeRedemption,
  input: ReservePromoCodeInput,
  now: Date
): PromoCodeRedemption {
  const samePayment = reservation.userId.equals(input.userId) &&
    reservation.workspaceId.equals(input.workspaceId) &&
    reservation.tariffPlanId.equals(input.tariffPlanId) &&
    reservation.originalAmount === input.originalAmount;
  const canReuse = reservation.status === 'reserved' &&
    reservation.expiresAt && reservation.expiresAt > now &&
    !reservation.transactionId;

  if (!samePayment || !canReuse) {
    throw new UserInputError('PROMO_CODE_ALREADY_USED');
  }

  return reservation;
}

/**
 * Reserve a discounted payment without changing the promo code's configured limit.
 * Unique indexes enforce the per-user and per-workspace restrictions.
 *
 * @param db - accounts database
 * @param input - payment being prepared
 * @param now - reservation time
 * @returns new reservation or the existing reservation for an identical retry
 */
export async function reservePromoCode(
  db: Db,
  input: ReservePromoCodeInput,
  now = new Date()
): Promise<PromoCodeRedemption> {
  const promoCode = await findActivePromoCode(db, input.promoCode, input.tariffPlanId);
  const finalAmount = calculateDiscountedAmount(input.originalAmount, promoCode.discountPercent);
  const redemptions = db.collection<PromoCodeRedemption>('promoCodeRedemptions');

  await releaseExpiredPromoCodeReservations(db, promoCode._id, now);

  const existingUseQuery = {
    promoCodeId: promoCode._id,
    $or: [
      { userId: input.userId },
      { workspaceId: input.workspaceId },
    ],
  };
  const existingReservation = await redemptions.findOne(existingUseQuery);

  if (existingReservation) {
    return reuseReservation(existingReservation, input, now);
  }

  if (promoCode.maxUses !== undefined) {
    const occupiedUses = await redemptions.countDocuments({
      promoCodeId: promoCode._id,
      status: { $in: ['reserved', 'used'] },
    });

    /**
     * MVP trade-off: count and insert are not atomic. Concurrent users/workspaces
     * may exceed maxUses; strict global enforcement is intentionally deferred.
     * Reservations keep occupying quota until explicitly released, not by TTL.
     */
    if (occupiedUses + 1 > promoCode.maxUses) {
      throw new UserInputError('PROMO_CODE_INVALID');
    }
  }

  const expiresAt = new Date(now.getTime() + RESERVATION_DURATION_MS);
  const reservation: PromoCodeRedemption = {
    _id: new ObjectId(),
    promoCodeId: promoCode._id,
    userId: input.userId,
    workspaceId: input.workspaceId,
    tariffPlanId: input.tariffPlanId,
    status: 'reserved',
    originalAmount: input.originalAmount,
    finalAmount,
    discountPercent: promoCode.discountPercent,
    createdAt: now,
    expiresAt,
  };

  try {
    await redemptions.insertOne(reservation);
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.code !== 11000) {
      throw error;
    }

    const concurrentReservation = await redemptions.findOne(existingUseQuery);

    if (concurrentReservation) {
      return reuseReservation(concurrentReservation, input, now);
    }

    throw error;
  }

  return reservation;
}
