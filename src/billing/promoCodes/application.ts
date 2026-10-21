import type { Db, ObjectId } from 'mongodb';

/**
 * Apply a payment's billing period and subscription atomically, without resetting
 * usage on a retry. Preserve superseded subscriptions until cancellation succeeds.
 *
 * @param db - accounts database
 * @param workspaceId - paid workspace
 * @param planId - paid plan
 * @param operationId - stable business operation identifier
 * @param paymentDate - stable operation creation time
 * @param subscriptionId - new subscription, or null for a one-time payment
 * @param isCardLinkOperation - replace the subscription without restarting the paid period
 * @returns whether this payment still owns the workspace billing state
 */
export async function applyPaidPlan(
  db: Db,
  workspaceId: ObjectId,
  planId: ObjectId,
  operationId: ObjectId,
  paymentDate: Date,
  subscriptionId: string | null = null,
  isCardLinkOperation = false
): Promise<boolean> {
  if (!(paymentDate instanceof Date) || !Number.isFinite(paymentDate.getTime())) {
    throw new Error('PROMO_PAYMENT_INVALID_DATE');
  }

  /**
   * Linking a card must not supersede a paid billing period whose callback is delayed.
   */
  const paymentIdField = isCardLinkOperation ? 'cardLinkPaymentId' : 'billingPaymentId';
  const paymentDateField = isCardLinkOperation ? 'cardLinkPaymentDate' : 'billingPaymentDate';
  const workspaces = db.collection('workspaces');
  const result = await workspaces.updateOne({
    _id: workspaceId,
    [paymentIdField]: { $ne: operationId },
    $and: [
      {
        $or: [
          { lastChargeDate: { $exists: false } },
          { lastChargeDate: { $lte: paymentDate } },
        ],
      },
      {
        $or: [
          { [paymentDateField]: { $exists: false } },
          { [paymentDateField]: { $lt: paymentDate } },
          {
            [paymentDateField]: paymentDate,
            [paymentIdField]: { $lt: operationId },
          },
        ],
      },
    ],
  }, [
    {
      $set: {
        [paymentIdField]: { $literal: operationId },
        [paymentDateField]: { $literal: paymentDate },
        subscriptionIdsToCancel: {
          $setUnion: [
            {
              $setDifference: [
                { $ifNull: ['$subscriptionIdsToCancel', [] ] },
                { $literal: subscriptionId ? [ subscriptionId ] : [] },
              ],
            },
            {
              $cond: [
                {
                  $and: [
                    { $ne: [ { $ifNull: ['$subscriptionId', null] }, null] },
                    { $ne: ['$subscriptionId', { $literal: subscriptionId } ] },
                  ],
                },
                [ '$subscriptionId' ],
                [],
              ],
            },
          ],
        },
        subscriptionId: subscriptionId ? { $literal: subscriptionId } : '$$REMOVE',
        ...(!isCardLinkOperation ? {
          tariffPlanId: { $literal: planId },
          billingPeriodEventsCount: 0,
          lastChargeDate: { $literal: paymentDate },
        } : {}),
      },
    },
  ]);

  if (result.matchedCount === 1) {
    return true;
  }

  const workspace = await workspaces.findOne({ _id: workspaceId });

  if (!workspace) {
    throw new Error('Workspace not found');
  }

  const ownsBillingPeriod = workspace[paymentIdField]?.equals(operationId) === true &&
    workspace[paymentDateField]?.getTime() === paymentDate.getTime() &&
    (isCardLinkOperation
      ? (!workspace.lastChargeDate || workspace.lastChargeDate <= paymentDate) &&
        workspace.subscriptionId === (subscriptionId || undefined)
      : workspace.lastChargeDate?.getTime() === paymentDate.getTime());

  if (!ownsBillingPeriod && subscriptionId) {
    /**
     * A late paid callback must not leave its superseded subscription charging again.
     */
    await workspaces.updateOne({
      _id: workspaceId,
      subscriptionId: { $ne: subscriptionId },
    }, {
      $addToSet: { subscriptionIdsToCancel: subscriptionId },
    });
  }

  return ownsBillingPeriod;
}
