import { Db, MongoClient, ObjectId } from 'mongodb';
import { applyPromoPlan } from '../../../src/billing/promoCodes/application';

const PAYMENT_DATE = new Date('2026-10-13T12:00:00.000Z');

describe('Promo plan application', () => {
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
    const date = PAYMENT_DATE;

    const result = await applyPromoPlan(db, workspaceId, planId, operationId, date);
    const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });

    expect(result).toBe(true);
    expect(workspace).toMatchObject({
      tariffPlanId: planId,
      billingPeriodEventsCount: 0,
      lastChargeDate: date,
      promoCodePaymentId: operationId,
    });
  });

  test('should not reset usage or advance the billing date when the payment is retried', async () => {
    await applyPromoPlan(db, workspaceId, planId, operationId, PAYMENT_DATE);
    await db.collection('workspaces').updateOne({ _id: workspaceId }, {
      $set: { billingPeriodEventsCount: 7 },
    });

    const result = await applyPromoPlan(db, workspaceId, planId, operationId, PAYMENT_DATE);
    const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });

    expect(result).toBe(true);
    expect(workspace?.billingPeriodEventsCount).toBe(7);
    expect(workspace?.lastChargeDate).toEqual(PAYMENT_DATE);
  });

  test('should not overwrite a newer paid plan with an older callback', async () => {
    await applyPromoPlan(db, workspaceId, planId, operationId, PAYMENT_DATE);

    const newerPlanId = new ObjectId();
    const newerOperationId = new ObjectId();
    const newerDate = new Date(PAYMENT_DATE.getTime() + 60 * 60 * 1000);

    await applyPromoPlan(db, workspaceId, newerPlanId, newerOperationId, newerDate);

    const result = await applyPromoPlan(db, workspaceId, planId, operationId, PAYMENT_DATE);
    const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });

    expect(result).toBe(false);
    expect(workspace?.tariffPlanId).toEqual(newerPlanId);
    expect(workspace?.lastChargeDate).toEqual(newerDate);
    expect(workspace?.promoCodePaymentId).toEqual(newerOperationId);
  });

  test('should preserve usage after concurrent callbacks for the same payment', async () => {
    const requests = [operationId, operationId];

    const results = await Promise.all(requests.map(id => applyPromoPlan(db, workspaceId, planId, id, PAYMENT_DATE)));

    await db.collection('workspaces').updateOne({ _id: workspaceId }, {
      $set: { billingPeriodEventsCount: 7 },
    });
    await applyPromoPlan(db, workspaceId, planId, operationId, PAYMENT_DATE);
    const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });

    expect(results).toEqual([true, true]);
    expect(workspace?.billingPeriodEventsCount).toBe(7);
    expect(workspace?.promoCodePaymentId).toEqual(operationId);
  });

  test('should reject a missing workspace', async () => {
    const missingWorkspaceId = new ObjectId();

    const result = applyPromoPlan(db, missingWorkspaceId, planId, operationId, PAYMENT_DATE);

    await expect(result).rejects.toThrow('Workspace not found');
  });

  test('should reject an invalid payment date without changing the workspace', async () => {
    const invalidDate = new Date('invalid');

    const result = applyPromoPlan(db, workspaceId, planId, operationId, invalidDate);

    await expect(result).rejects.toThrow('PROMO_PAYMENT_INVALID_DATE');
    const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });

    expect(workspace?.billingPeriodEventsCount).toBe(50);
    expect(workspace?.promoCodePaymentId).toBeUndefined();
  });
});
