import type { Request, Response } from 'express';
import { Db, MongoClient, ObjectId } from 'mongodb';
import type { Document, WithId } from 'mongodb';
import CloudPaymentsWebhooks from '../../../src/billing/cloudpayments';
import type { PaymentData } from '../../../src/billing/types/paymentData';
import { SubscriptionStatus } from '../../../src/billing/types/enums';
import { BusinessOperationStatus, BusinessOperationType } from '@hawk.so/types';
import { databases } from '../../../src/mongo';
import DataLoaders from '../../../src/dataLoaders';
import WorkspacesFactory from '../../../src/models/workspacesFactory';
import UsersFactory from '../../../src/models/usersFactory';
import PlansFactory from '../../../src/models/plansFactory';
import BusinessOperationsFactory from '../../../src/models/businessOperationsFactory';
import checksumService from '../../../src/utils/checksumService';
import { publish } from '../../../src/rabbitmq';
import sendNotification from '../../../src/utils/personalNotifications';

/**
 * Metrics starts a process-wide cleanup interval; it is unrelated to callback persistence.
 */
jest.mock('../../../src/metrics', () => ({
  setupMongoMetrics: jest.fn(),
  withMongoMetrics: (options: unknown): unknown => options,
}));
jest.mock('../../../src/rabbitmq', () => ({ publish: jest.fn() }));
jest.mock('../../../src/utils/personalNotifications', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../../../src/utils/telegram', () => ({
  ...jest.requireActual('../../../src/utils/telegram'),
  sendMessage: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@hawk.so/nodejs', () => ({
  __esModule: true,
  default: { send: jest.fn() },
}));
jest.mock('cloudpayments', () => ({
  ...jest.requireActual('cloudpayments'),
  ClientService: jest.fn().mockImplementation(() => ({
    getClientApi: (): { cancelSubscription: jest.Mock } => ({
      cancelSubscription: jest.fn().mockResolvedValue({ isSuccess: (): boolean => true }),
    }),
    getReceiptApi: (): { createReceipt: jest.Mock } => ({ createReceipt: jest.fn().mockResolvedValue(undefined) }),
  })),
}));

const PAYMENT_DATE = new Date('2026-10-13T12:00:00.000Z');
const NEWER_PAYMENT_DATE = new Date('2026-10-13T13:00:00.000Z');

/**
 * Test view exposing callback handlers and mocked external APIs, including private members.
 */
type TestCallbacks = {
  finishPromoPayment(req: Request, res: Response, data: PaymentData, succeeded: boolean): Promise<void>;
  pay(req: Request, res: Response): Promise<void>;
  recurrent(req: Request, res: Response): Promise<void>;
  clientApi: { cancelSubscription: jest.Mock };
  receiptApi: { createReceipt: jest.Mock };
};

/**
 * Create a barrier for pausing a callback during an external cancellation.
 *
 * @returns A promise and the function that releases waiting callbacks.
 */
function semaphore(): { promise: Promise<void>; release: () => void } {
  let release!: () => void;
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });

  return {
    promise,
    release,
  };
}

/**
 * Create a chainable response mock for inspecting callback acknowledgements.
 *
 * @returns An Express response with mocked JSON and status methods.
 */
function response(): Response & { json: jest.Mock; status: jest.Mock } {
  return {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
  } as unknown as Response & { json: jest.Mock; status: jest.Mock };
}

describe('Promo payment callbacks with MongoDB', () => {
  let client: MongoClient;
  let db: Db;
  let callbacks: TestCallbacks;
  let workspaceId: ObjectId;
  let userId: ObjectId;
  let factories: {
    workspacesFactory: WorkspacesFactory;
    usersFactory: UsersFactory;
    plansFactory: PlansFactory;
    businessOperationsFactory: BusinessOperationsFactory;
  };
  const previousDatabase = databases.hawk;
  const previousSecret = process.env.JWT_SECRET_BILLING_CHECKSUM;

  beforeAll(async () => {
    const globals = global as unknown as { __MONGO_URI__?: string };
    const uri = process.env.MONGO_URL || globals.__MONGO_URI__;

    if (!uri) {
      throw new Error('Jest MongoDB test URI is not configured');
    }

    client = new MongoClient(uri);
    await client.connect();
    db = client.db('promo-callback-tests');
    databases.hawk = db;
    process.env.JWT_SECRET_BILLING_CHECKSUM = 'promo-callback-tests-only';
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.mocked(publish).mockResolvedValue(undefined);
    jest.mocked(sendNotification).mockResolvedValue(undefined);
    await db.dropDatabase();
    await db.collection('promoCodeRedemptions').createIndex({
      promoCodeId: 1,
      userId: 1,
    }, { unique: true });
    await db.collection('promoCodeRedemptions').createIndex({
      promoCodeId: 1,
      workspaceId: 1,
    }, { unique: true });
    workspaceId = new ObjectId();
    userId = new ObjectId();
    await db.collection('workspaces').insertOne({
      _id: workspaceId,
      name: 'Callback workspace',
      tariffPlanId: new ObjectId(),
      billingPeriodEventsCount: 50,
      lastChargeDate: new Date(PAYMENT_DATE.getTime() - 86400000),
      subscriptionId: 'sub-old',
    });
    await db.collection('users').insertOne({
      _id: userId,
      email: 'callback@example.test',
    });
    const loaders = new DataLoaders(db);

    factories = {
      workspacesFactory: new WorkspacesFactory(db, loaders),
      usersFactory: new UsersFactory(db, loaders),
      plansFactory: new PlansFactory(db, loaders),
      businessOperationsFactory: new BusinessOperationsFactory(db, loaders),
    };
    callbacks = new CloudPaymentsWebhooks() as unknown as TestCallbacks;
  });

  afterAll(async () => {
    databases.hawk = previousDatabase;
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET_BILLING_CHECKSUM;
    } else {
      process.env.JWT_SECRET_BILLING_CHECKSUM = previousSecret;
    }
    if (db) {
      await db.dropDatabase();
    }
    if (client) {
      await client.close();
    }
  });

  /**
   * Persist a pending purchase and prepare its signed payment callback.
   *
   * @param label - Payment label used for plan, promo code, transaction and subscription fixtures.
   * @param date - Creation date of the pending business operation.
   * @param promo - Whether to include promo code data and a discounted amount.
   * @returns The operation and plan identifiers, decoded payment data and callback request.
   */
  async function payment(label: string, date: Date, promo = true): Promise<{
    operationId: ObjectId;
    planId: ObjectId;
    data: PaymentData;
    req: Request;
  }> {
    const operationId = new ObjectId();
    const planId = new ObjectId();
    const promoCodeId = new ObjectId();
    const amount = promo ? 80 : 100;
    const transactionId = label === 'A' ? 1001 : 1002;
    const signedData = {
      workspaceId: workspaceId.toHexString(),
      userId: userId.toHexString(),
      tariffPlanId: planId.toHexString(),
      shouldSaveCard: false,
      nextPaymentDate: '2026-11-13T12:00:00.000Z',
      ...(promo ? {
        promoPaymentId: operationId.toHexString(),
        promoCodeId: promoCodeId.toHexString(),
        originalAmount: 100,
        paymentAmount: amount,
        discountPercent: 20,
      } : {}),
    };

    await db.collection('plans').insertOne({
      _id: planId,
      name: `Plan ${label}`,
      monthlyCharge: 100,
    });
    if (promo) {
      await db.collection('promoCodes').insertOne({
        _id: promoCodeId,
        value: `PROMO-${label}`,
        discountPercent: 20,
      });
    }
    await db.collection('businessOperations').insertOne({
      _id: operationId,
      transactionId: transactionId.toString(),
      type: BusinessOperationType.WorkspacePlanPurchase,
      status: BusinessOperationStatus.Pending,
      dtCreated: date,
      payload: {
        workspaceId,
        userId,
        tariffPlanId: planId,
        amount: amount * 100,
        currency: 'RUB',
      },
    });
    const checksum = await checksumService.generateChecksum(signedData);
    const data: PaymentData = {
      ...signedData,
      isCardLinkOperation: false,
    };
    const req = {
      path: '/pay',
      body: {
        TransactionId: transactionId,
        Amount: amount.toString(),
        Currency: 'RUB',
        SubscriptionId: `sub-${label}`,
        IssuerBankCountry: 'RU',
        Data: JSON.stringify({ checksum }),
      },
      context: { factories },
    } as unknown as Request;

    return {
      operationId,
      planId,
      data,
      req,
    };
  }

  /**
   * Resume a successful promo payment through the real completion handler.
   *
   * @param attempt - Persisted purchase and its callback data.
   * @returns The response mock containing the callback acknowledgement.
   */
  async function finish(attempt: Awaited<ReturnType<typeof payment>>): Promise<ReturnType<typeof response>> {
    const res = response();

    /**
     * Only the private visibility is bypassed: the callback, plan application and models are real.
     */
    await callbacks.finishPromoPayment(attempt.req, res, attempt.data, true);

    return res;
  }

  /**
   * Process a payment callback and assert a successful acknowledgement.
   *
   * @param attempt - Persisted purchase with the callback request to process.
   * @returns The response mock after successful payment processing.
   */
  async function pay(attempt: Awaited<ReturnType<typeof payment>>): Promise<ReturnType<typeof response>> {
    const res = response();

    await callbacks.pay(attempt.req, res);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ code: 0 });

    return res;
  }

  /**
   * Read the current workspace state after callback processing.
   *
   * @returns The persisted workspace document, or null if it is absent.
   */
  async function workspace(): Promise<WithId<Document> | null> {
    return db.collection('workspaces').findOne({ _id: workspaceId });
  }

  /**
   * Assert promo payment completion, released processing ownership and a single redemption.
   *
   * @param attempt - Promo purchase whose persisted completion state should be checked.
   * @returns Resolves when all completion assertions pass.
   */
  async function expectFinished(attempt: Awaited<ReturnType<typeof payment>>): Promise<void> {
    expect(await db.collection('businessOperations').findOne({ _id: attempt.operationId })).toMatchObject({
      status: BusinessOperationStatus.Confirmed,
      promoReceiptSent: true,
      promoNotificationSent: true,
    });
    expect(await db.collection('businessOperations').findOne({ _id: attempt.operationId })).not.toHaveProperty('promoProcessingToken');
    expect(await db.collection('promoCodeRedemptions').countDocuments({
      promoCodeId: new ObjectId(attempt.data.promoCodeId),
    })).toBe(1);
  }

  test('retry of pending promo A must not cancel or replace subscription B from a later ordinary payment', async () => {
    const a = await payment('A', PAYMENT_DATE);
    const b = await payment('B', NEWER_PAYMENT_DATE, false);

    jest.mocked(publish).mockRejectedValueOnce(new Error('limiter publish failed'));
    const failed = await finish(a);

    expect(failed.status).toHaveBeenCalledWith(500);
    expect(failed.json).toHaveBeenCalledWith({ code: 1 });
    expect(await workspace()).toMatchObject({
      tariffPlanId: a.planId,
      lastChargeDate: PAYMENT_DATE,
      billingPaymentId: a.operationId,
      billingPaymentDate: PAYMENT_DATE,
      subscriptionId: 'sub-A',
    });
    expect(await db.collection('businessOperations').findOne({ _id: a.operationId })).toMatchObject({
      status: BusinessOperationStatus.Pending,
    });

    await pay(b);
    const afterB = await workspace();

    expect(afterB).toMatchObject({
      tariffPlanId: b.planId,
      subscriptionId: 'sub-B',
      billingPaymentId: b.operationId,
      billingPaymentDate: NEWER_PAYMENT_DATE,
      lastChargeDate: NEWER_PAYMENT_DATE,
      subscriptionIdsToCancel: [],
    });
    await db.collection('workspaces').updateOne({ _id: workspaceId }, { $set: { billingPeriodEventsCount: 7 } });
    const cancellationsBeforeRetry = callbacks.clientApi.cancelSubscription.mock.calls.length;

    for (let retry = 0; retry < 2; retry++) {
      const res = await finish(a);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ code: 0 });
    }
    await expectFinished(a);
    expect(callbacks.receiptApi.createReceipt).toHaveBeenCalledTimes(2);
    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(callbacks.clientApi.cancelSubscription.mock.calls.slice(cancellationsBeforeRetry))
      .not.toContainEqual([ { Id: 'sub-B' } ]);
    expect(await workspace()).toMatchObject({
      tariffPlanId: b.planId,
      lastChargeDate: NEWER_PAYMENT_DATE,
      billingPaymentId: b.operationId,
      billingPaymentDate: NEWER_PAYMENT_DATE,
      subscriptionId: 'sub-B',
      subscriptionIdsToCancel: [],
      billingPeriodEventsCount: 7,
    });
  });

  test.each([
    ['promo', 'reject'],
    ['promo', 'false'],
    ['ordinary', 'reject'],
    ['ordinary', 'false'],
  ] as const)(
    '%s cancellation %s must retain the pending subscription and retry without resetting usage',
    async (kind, failure) => {
      const a = await payment('A', PAYMENT_DATE, kind === 'promo');

      if (failure === 'reject') {
        callbacks.clientApi.cancelSubscription.mockRejectedValueOnce(new Error('subscription cancellation failed'));
      } else {
        callbacks.clientApi.cancelSubscription.mockResolvedValueOnce({ isSuccess: (): boolean => false });
      }
      const failed = response();

      await callbacks.pay(a.req, failed);
      expect(failed.status).toHaveBeenCalledWith(500);
      expect(await workspace()).toMatchObject({
        tariffPlanId: a.planId,
        lastChargeDate: PAYMENT_DATE,
        billingPaymentId: a.operationId,
        billingPaymentDate: PAYMENT_DATE,
        subscriptionId: 'sub-A',
        subscriptionIdsToCancel: [ 'sub-old' ],
      });
      expect(await db.collection('businessOperations').findOne({ _id: a.operationId })).toMatchObject({
        status: BusinessOperationStatus.Pending,
      });
      expect(callbacks.receiptApi.createReceipt).not.toHaveBeenCalled();
      expect(sendNotification).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
      await db.collection('workspaces').updateOne({ _id: workspaceId }, { $set: { billingPeriodEventsCount: 7 } });

      await pay(a);
      expect(await workspace()).toMatchObject({
        tariffPlanId: a.planId,
        lastChargeDate: PAYMENT_DATE,
        billingPaymentId: a.operationId,
        billingPaymentDate: PAYMENT_DATE,
        subscriptionId: 'sub-A',
        subscriptionIdsToCancel: [],
        billingPeriodEventsCount: 7,
      });
      expect(callbacks.clientApi.cancelSubscription.mock.calls).toEqual([
        [ { Id: 'sub-old' } ],
        [ { Id: 'sub-old' } ],
      ]);
      expect(callbacks.receiptApi.createReceipt).toHaveBeenCalledTimes(1);
      expect(sendNotification).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledTimes(1);
      expect(await db.collection('businessOperations').findOne({ _id: a.operationId })).toMatchObject({
        status: BusinessOperationStatus.Confirmed,
      });
      if (kind === 'promo') {
        await expectFinished(a);
      }
    }
  );

  test.each([SubscriptionStatus.CANCELLED, SubscriptionStatus.REJECTED])(
    'stale /recurrent %s must not clear a newer active subscription',
    async status => {
      const snapshot = await factories.workspacesFactory.findBySubscriptionId('sub-old');

      expect(snapshot).not.toBeNull();
      const b = await payment('B', NEWER_PAYMENT_DATE);

      await pay(b);
      const afterB = await workspace();
      const lookup = jest.spyOn(factories.workspacesFactory, 'findBySubscriptionId').mockResolvedValue(snapshot);
      const req = {
        path: '/recurrent',
        body: {
          Id: 'sub-old',
          Status: status,
        },
        context: { factories },
      } as unknown as Request;
      const res = response();

      try {
        await callbacks.recurrent(req, res);
        expect(lookup).toHaveBeenCalledWith('sub-old');
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ code: 0 });
        expect(await workspace()).toEqual(afterB);
        expect(await workspace()).toMatchObject({ subscriptionId: 'sub-B' });
      } finally {
        lookup.mockRestore();
      }
    }
  );

  test.each([
    ['promo', 'promo'],
    ['promo', 'ordinary'],
    ['ordinary', 'promo'],
  ] as const)(
    '%s A / %s B: newer B must retain its plan and subscription when A resumes after external cancellation',
    async (kindA, kindB) => {
      const a = await payment('A', PAYMENT_DATE, kindA === 'promo');
      const b = await payment('B', NEWER_PAYMENT_DATE, kindB === 'promo');
      const cancellationEntered = semaphore();
      const resumeCancellation = semaphore();
      let paused = false;

      callbacks.clientApi.cancelSubscription.mockImplementation(async ({ Id }: { Id: string }) => {
        if (Id === 'sub-old' && !paused) {
          paused = true;
          cancellationEntered.release();
          await resumeCancellation.promise;
        }

        return { isSuccess: (): boolean => true };
      });
      const aResponse = response();
      const runningA = callbacks.pay(a.req, aResponse);

      try {
        await Promise.race([
          cancellationEntered.promise,
          runningA.then(() => {
            throw new Error('Payment A finished without reaching the cancellation barrier');
          }),
        ]);
        expect(await workspace()).toMatchObject({
          tariffPlanId: a.planId,
          lastChargeDate: PAYMENT_DATE,
          subscriptionId: 'sub-A',
          subscriptionIdsToCancel: [ 'sub-old' ],
        });
        await pay(b);
        expect(await workspace()).toMatchObject({
          tariffPlanId: b.planId,
          lastChargeDate: NEWER_PAYMENT_DATE,
          billingPaymentId: b.operationId,
          billingPaymentDate: NEWER_PAYMENT_DATE,
          subscriptionId: 'sub-B',
          subscriptionIdsToCancel: [],
        });
      } finally {
        resumeCancellation.release();
        await runningA;
      }
      expect(aResponse.status).not.toHaveBeenCalled();
      expect(aResponse.json).toHaveBeenCalledWith({ code: 0 });
      const afterRace = await workspace();

      await db.collection('workspaces').updateOne({ _id: workspaceId }, { $set: { billingPeriodEventsCount: 7 } });
      const cancellations = callbacks.clientApi.cancelSubscription.mock.calls.length;
      const receipts = callbacks.receiptApi.createReceipt.mock.calls.length;
      const notifications = jest.mocked(sendNotification).mock.calls.length;
      const publications = jest.mocked(publish).mock.calls.length;

      if (kindA === 'promo') {
        await pay(a);
        await expectFinished(a);
      }
      if (kindB === 'promo') {
        await pay(b);
        await expectFinished(b);
      }
      expect(callbacks.clientApi.cancelSubscription).toHaveBeenCalledTimes(cancellations);
      expect(callbacks.receiptApi.createReceipt).toHaveBeenCalledTimes(receipts);
      expect(sendNotification).toHaveBeenCalledTimes(notifications);
      expect(publish).toHaveBeenCalledTimes(publications);
      if (kindA === 'ordinary') {
        await pay(a);
      }
      expect(callbacks.clientApi.cancelSubscription).not.toHaveBeenCalledWith({ Id: 'sub-B' });
      expect(await workspace()).toEqual({
        ...afterRace,
        billingPeriodEventsCount: 7,
      });
      expect(afterRace).toMatchObject({
        tariffPlanId: b.planId,
        lastChargeDate: NEWER_PAYMENT_DATE,
        billingPaymentId: b.operationId,
        billingPaymentDate: NEWER_PAYMENT_DATE,
        subscriptionId: 'sub-B',
        subscriptionIdsToCancel: [],
      });
    }
  );
});
