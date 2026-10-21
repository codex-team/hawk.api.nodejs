import { Db, MongoClient, ObjectId } from 'mongodb';
import { applyPaidPlan } from '../../../src/billing/promoCodes/application';

const PAYMENT_DATE = new Date('2026-10-13T12:00:00.000Z');

/**
 * Ordinary and promo callbacks must use the same atomic billing transition.
 */
describe('Paid plan application', () => {
  let client: MongoClient;
  let db: Db;
  let workspaceId: ObjectId;
  let planId: ObjectId;
  let operationId: ObjectId;

  beforeAll(async () => {
    const globals = global as unknown as { __MONGO_URI__?: string };
    const uri = process.env.MONGO_URL || globals.__MONGO_URI__;

    if (!uri) {
      throw new Error('Jest MongoDB test URI is not configured');
    }

    client = new MongoClient(uri);
    await client.connect();
    db = client.db('promo-plan-application-tests');
  });

  beforeEach(async () => {
    await db.dropDatabase();
    workspaceId = new ObjectId();
    planId = new ObjectId();
    operationId = new ObjectId();
    await db.collection('workspaces').insertOne({
      _id: workspaceId,
      tariffPlanId: new ObjectId(),
      billingPeriodEventsCount: 50,
      lastChargeDate: new Date(PAYMENT_DATE.getTime() - 24 * 60 * 60 * 1000),
    });
  });

  afterAll(async () => {
    if (db) {
      await db.dropDatabase();
    }

    if (client) {
      await client.close();
    }
  });

  test('should apply a paid plan and store its stable payment date and marker', async () => {
    const result = await applyPaidPlan(db, workspaceId, planId, operationId, PAYMENT_DATE);
    const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });

    expect(result).toBe(true);
    expect(workspace).toMatchObject({
      tariffPlanId: planId,
      billingPeriodEventsCount: 0,
      lastChargeDate: PAYMENT_DATE,
      billingPaymentDate: PAYMENT_DATE,
      billingPaymentId: operationId,
    });
  });

  test('should not reset usage or advance the billing date when the payment is retried', async () => {
    await applyPaidPlan(db, workspaceId, planId, operationId, PAYMENT_DATE);
    await db.collection('workspaces').updateOne({ _id: workspaceId }, {
      $set: { billingPeriodEventsCount: 7 },
    });

    const result = await applyPaidPlan(db, workspaceId, planId, operationId, PAYMENT_DATE);
    const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });

    expect(result).toBe(true);
    expect(workspace?.billingPeriodEventsCount).toBe(7);
    expect(workspace?.lastChargeDate).toEqual(PAYMENT_DATE);
  });

  test('should not overwrite a newer paid plan with an older callback', async () => {
    await applyPaidPlan(db, workspaceId, planId, operationId, PAYMENT_DATE);
    const newerPlanId = new ObjectId();
    const newerOperationId = new ObjectId();
    const newerDate = new Date(PAYMENT_DATE.getTime() + 60 * 60 * 1000);

    await applyPaidPlan(db, workspaceId, newerPlanId, newerOperationId, newerDate, 'sub-new');

    const result = await applyPaidPlan(db, workspaceId, planId, operationId, PAYMENT_DATE, 'sub-old');
    const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });

    expect(result).toBe(false);
    expect(workspace).toMatchObject({
      tariffPlanId: newerPlanId,
      lastChargeDate: newerDate,
      billingPaymentId: newerOperationId,
      subscriptionId: 'sub-new',
      subscriptionIdsToCancel: [ 'sub-old' ],
    });
  });

  test('should reject old ownership when a later billing update leaves the payment marker unchanged', async () => {
    await applyPaidPlan(db, workspaceId, planId, operationId, PAYMENT_DATE, 'sub-old');
    const newerDate = new Date(PAYMENT_DATE.getTime() + 60 * 60 * 1000);

    await db.collection('workspaces').updateOne({ _id: workspaceId }, {
      $set: {
        lastChargeDate: newerDate,
        subscriptionId: 'sub-new',
        billingPeriodEventsCount: 7,
      },
    });

    const result = await applyPaidPlan(db, workspaceId, planId, operationId, PAYMENT_DATE, 'sub-old');
    const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });

    expect(result).toBe(false);
    expect(workspace?.subscriptionId).toBe('sub-new');
    expect(workspace?.billingPeriodEventsCount).toBe(7);
    expect(workspace?.lastChargeDate).toEqual(newerDate);
  });

  test('should preserve usage after concurrent callbacks for the same payment', async () => {
    const requests = [operationId, operationId];
    const results = await Promise.all(requests.map(id => applyPaidPlan(db, workspaceId, planId, id, PAYMENT_DATE)));

    await db.collection('workspaces').updateOne({ _id: workspaceId }, {
      $set: { billingPeriodEventsCount: 7 },
    });
    await applyPaidPlan(db, workspaceId, planId, operationId, PAYMENT_DATE);
    const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });

    expect(results).toEqual([true, true]);
    expect(workspace?.billingPeriodEventsCount).toBe(7);
    expect(workspace?.billingPaymentId).toEqual(operationId);
  });

  test('should atomically replace the subscription and retain pending cancellations on retry', async () => {
    await db.collection('workspaces').updateOne({ _id: workspaceId }, {
      $set: { subscriptionId: 'sub-old' },
    });
    await applyPaidPlan(db, workspaceId, planId, operationId, PAYMENT_DATE, 'sub-new');
    await applyPaidPlan(db, workspaceId, planId, operationId, PAYMENT_DATE, 'sub-new');
    const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });

    expect(workspace).toMatchObject({
      tariffPlanId: planId,
      subscriptionId: 'sub-new',
      subscriptionIdsToCancel: [ 'sub-old' ],
    });
  });

  test('should remove a subscription for a one-time payment without losing its cancellation', async () => {
    await db.collection('workspaces').updateOne({ _id: workspaceId }, {
      $set: { subscriptionId: 'sub-old' },
    });
    await applyPaidPlan(db, workspaceId, planId, operationId, PAYMENT_DATE);
    const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });

    expect(workspace).not.toHaveProperty('subscriptionId');
    expect(workspace?.subscriptionIdsToCancel).toEqual([ 'sub-old' ]);
  });

  test('should keep the paid period and usage when only linking a card', async () => {
    const before = await db.collection('workspaces').findOne({ _id: workspaceId });

    await applyPaidPlan(db, workspaceId, planId, operationId, PAYMENT_DATE, 'sub-card', true);
    const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });

    expect(workspace?.tariffPlanId).toEqual(before?.tariffPlanId);
    expect(workspace?.lastChargeDate).toEqual(before?.lastChargeDate);
    expect(workspace?.billingPeriodEventsCount).toBe(50);
    expect(workspace?.subscriptionId).toBe('sub-card');
  });

  test('a newer card link must not prevent applying an earlier successful plan purchase', async () => {
    const cardLinkId = new ObjectId();
    const cardLinkDate = new Date(PAYMENT_DATE.getTime() + 60 * 60 * 1000);

    await applyPaidPlan(db, workspaceId, planId, cardLinkId, cardLinkDate, 'sub-card', true);
    const result = await applyPaidPlan(db, workspaceId, planId, operationId, PAYMENT_DATE, 'sub-paid');
    const retry = await applyPaidPlan(db, workspaceId, planId, cardLinkId, cardLinkDate, 'sub-card', true);
    const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });

    expect(result).toBe(true);
    expect(retry).toBe(false);
    expect(workspace).toMatchObject({
      tariffPlanId: planId,
      lastChargeDate: PAYMENT_DATE,
      billingPaymentId: operationId,
      subscriptionId: 'sub-paid',
      subscriptionIdsToCancel: [ 'sub-card' ],
    });
  });

  test('an old card link must not replace a newer paid subscription', async () => {
    const newerDate = new Date(PAYMENT_DATE.getTime() + 60 * 60 * 1000);
    const paymentId = new ObjectId();

    await applyPaidPlan(db, workspaceId, planId, paymentId, newerDate, 'sub-paid');
    const result = await applyPaidPlan(db, workspaceId, planId, operationId, PAYMENT_DATE, 'sub-card', true);
    const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });

    expect(result).toBe(false);
    expect(workspace?.subscriptionId).toBe('sub-paid');
    expect(workspace?.billingPaymentId).toEqual(paymentId);
    expect(workspace?.subscriptionIdsToCancel).toEqual([ 'sub-card' ]);
  });

  test('payments checked at the same time must use their operation id as a stable tie breaker', async () => {
    const olderId = new ObjectId('000000000000000000000001');
    const newerId = new ObjectId('000000000000000000000002');

    await applyPaidPlan(db, workspaceId, planId, newerId, PAYMENT_DATE, 'sub-new');
    const result = await applyPaidPlan(db, workspaceId, new ObjectId(), olderId, PAYMENT_DATE, 'sub-old');
    const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });

    expect(result).toBe(false);
    expect(workspace?.tariffPlanId).toEqual(planId);
    expect(workspace?.subscriptionId).toBe('sub-new');
  });

  test('should reject a missing workspace', async () => {
    const result = applyPaidPlan(db, new ObjectId(), planId, operationId, PAYMENT_DATE);

    await expect(result).rejects.toThrow('Workspace not found');
  });

  test('should reject an invalid payment date without changing the workspace', async () => {
    const result = applyPaidPlan(db, workspaceId, planId, operationId, new Date('invalid'));

    await expect(result).rejects.toThrow('PROMO_PAYMENT_INVALID_DATE');
    const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });

    expect(workspace?.billingPeriodEventsCount).toBe(50);
    expect(workspace).not.toHaveProperty('billingPaymentId');
  });
});
