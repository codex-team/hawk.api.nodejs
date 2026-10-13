import type { Db, ObjectId } from 'mongodb';

/**
 * Apply a paid plan once without resetting usage on a callback retry.
 * The marker and billing fields are written in the same workspace update.
 * An older payment must not overwrite a newer billing period.
 *
 * @param db - accounts database
 * @param workspaceId - paid workspace
 * @param planId - paid plan
 * @param operationId - stable business operation identifier
 * @param paymentDate - stable operation creation time
 * @returns whether this payment owns the workspace billing period
 */
export async function applyPromoPlan(
  db: Db,
  workspaceId: ObjectId,
  planId: ObjectId,
  operationId: ObjectId,
  paymentDate: Date
): Promise<boolean> {
  if (!(paymentDate instanceof Date) || !Number.isFinite(paymentDate.getTime())) {
    throw new Error('PROMO_PAYMENT_INVALID_DATE');
  }

  const workspaces = db.collection('workspaces');
  const result = await workspaces.updateOne({
    _id: workspaceId,
    promoCodePaymentId: { $ne: operationId },
    $or: [
      { lastChargeDate: { $exists: false } },
      { lastChargeDate: { $lt: paymentDate } },
      {
        lastChargeDate: paymentDate,
        promoCodePaymentId: { $exists: false },
      },
      {
        lastChargeDate: paymentDate,
        promoCodePaymentId: { $lt: operationId },
      },
    ],
  }, {
    $set: {
      tariffPlanId: planId,
      billingPeriodEventsCount: 0,
      lastChargeDate: paymentDate,
      promoCodePaymentId: operationId,
    },
  });

  if (result.matchedCount === 1) {
    return true;
  }

  const workspace = await workspaces.findOne({ _id: workspaceId }, {
    projection: { promoCodePaymentId: 1 },
  });

  if (!workspace) {
    throw new Error('Workspace not found');
  }

  return workspace.promoCodePaymentId?.equals(operationId) === true;
}
