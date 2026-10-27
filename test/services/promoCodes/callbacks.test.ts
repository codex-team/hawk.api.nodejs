import type { Request, Response } from 'express';
import { Db, MongoClient, ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';
import HawkCatcher from '@hawk.so/nodejs';
import { BusinessOperationStatus, BusinessOperationType } from '@hawk.so/types';
import CloudPaymentsWebhooks from '../../../src/billing/cloudpayments';
import { CheckCodes } from '../../../src/billing/types';
import { ReasonCode, ReasonCodesTranscript, SubscriptionStatus } from '../../../src/billing/types/enums';
import { databases } from '../../../src/mongo';
import DataLoaders from '../../../src/dataLoaders';
import WorkspacesFactory from '../../../src/models/workspacesFactory';
import WorkspaceModel from '../../../src/models/workspace';
import UsersFactory from '../../../src/models/usersFactory';
import PlansFactory from '../../../src/models/plansFactory';
import BusinessOperationsFactory from '../../../src/models/businessOperationsFactory';
import PromoCodesFactory from '../../../src/models/promoCodesFactory';
import PromoCodeRedemptionsFactory from '../../../src/models/promoCodeRedemptionsFactory';
import checksumService from '../../../src/utils/checksumService';
import { publish } from '../../../src/rabbitmq';
import sendNotification from '../../../src/utils/personalNotifications';
import { sendMessage, TelegramBotURLs } from '../../../src/utils/telegram';
import { SenderWorkerTaskType } from '../../../src/types/userNotifications';

/*
 * Metrics starts an unrelated process-wide cleanup interval.
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

type Callback = 'check' | 'pay' | 'fail' | 'recurrent';
/*
 * Only private visibility is bypassed; handlers, models and factories are real.
 */
type TestCallbacks = Record<Callback, (req: Request, res: Response) => Promise<void>> & {
  clientApi: { cancelSubscription: jest.Mock };
  receiptApi: { createReceipt: jest.Mock };
};

const SECRET = 'promo-callback-tests-only';
const PAYMENT_DATE = new Date('2026-10-13T12:00:00.000Z');

describe('Payment callbacks with MongoDB', () => {
  let client: MongoClient;
  let db: Db;
  let callbacks: TestCallbacks;
  let workspaceId: ObjectId;
  let userId: ObjectId;
  let workspaceKeys: string[];
  let factories: {
    workspacesFactory: WorkspacesFactory;
    usersFactory: UsersFactory;
    plansFactory: PlansFactory;
    businessOperationsFactory: BusinessOperationsFactory;
    promoCodesFactory: PromoCodesFactory;
    promoCodeRedemptionsFactory: PromoCodeRedemptionsFactory;
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
    process.env.JWT_SECRET_BILLING_CHECKSUM = SECRET;
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
    const workspace = {
      _id: workspaceId,
      name: 'Callback workspace',
      tariffPlanId: new ObjectId(),
      billingPeriodEventsCount: 50,
      lastChargeDate: PAYMENT_DATE,
      subscriptionId: 'sub-old',
    };

    workspaceKeys = Object.keys(workspace).sort();
    await db.collection('workspaces').insertOne(workspace);
    await db.collection('users').insertOne({
      _id: userId,
      email: 'callback@example.test',
    });
    await db.collection(`team:${workspaceId}`).insertOne({
      userId,
      isAdmin: true,
    });
    const loaders = new DataLoaders(db);
    const redemptions = new PromoCodeRedemptionsFactory(db);

    factories = {
      workspacesFactory: new WorkspacesFactory(db, loaders),
      usersFactory: new UsersFactory(db, loaders),
      plansFactory: new PlansFactory(db, loaders),
      businessOperationsFactory: new BusinessOperationsFactory(db, loaders),
      promoCodesFactory: new PromoCodesFactory(db, redemptions),
      promoCodeRedemptionsFactory: redemptions,
    };
    callbacks = new CloudPaymentsWebhooks() as unknown as TestCallbacks;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    /*
     * No lease, payment-ordering or pending-cancellation markers belong on the workspace.
     */
    expect(Object.keys((await db.collection('workspaces').findOne({ _id: workspaceId }))!).sort()).toEqual(workspaceKeys);
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

  async function payment(promo = true) {
    const planId = new ObjectId();
    const promoCodeId = new ObjectId();
    const amount = promo ? 80 : 100;
    const signedData = {
      workspaceId: workspaceId.toHexString(),
      userId: userId.toHexString(),
      tariffPlanId: planId.toHexString(),
      shouldSaveCard: false,
      nextPaymentDate: '2026-11-13T12:00:00.000Z',
      ...(promo ? {
        promo: {
          promoCodeId: promoCodeId.toHexString(),
          originalAmount: 100,
          finalAmount: amount,
        },
      } : {}),
    };

    await db.collection('plans').insertOne({
      _id: planId,
      name: 'Paid plan',
      monthlyCharge: 100,
    });
    if (promo) {
      await db.collection('promoCodes').insertOne({
        _id: promoCodeId,
        value: 'PROMO',
        discount: {
          type: 'percent',
          value: 20,
        },
      });
    }
    const checksum = await checksumService.generateChecksum(signedData);
    const req = {
      body: {
        TransactionId: 1001,
        Amount: amount.toString(),
        Currency: 'RUB',
        SubscriptionId: 'sub-new',
        IssuerBankCountry: 'RU',
        Reason: 'Declined',
        ReasonCode: ReasonCode.DO_NOT_HONOR,
        Data: JSON.stringify({ checksum }),
      },
      context: { factories },
    } as unknown as Request;

    return {
      planId,
      promoCodeId,
      signedData,
      checksum,
      req,
    };
  }

  /*
   * Isolate completion tests from /check; the end-to-end test below covers their contract.
   */
  async function pending(attempt: Awaited<ReturnType<typeof payment>>, date = PAYMENT_DATE) {
    return factories.businessOperationsFactory.create({
      transactionId: attempt.req.body.TransactionId.toString(),
      type: BusinessOperationType.WorkspacePlanPurchase,
      status: BusinessOperationStatus.Pending,
      dtCreated: date,
      payload: {
        workspaceId,
        userId,
        tariffPlanId: attempt.planId,
        amount: Number(attempt.req.body.Amount) * 100,
        currency: 'RUB',
      },
    });
  }

  async function invoke(method: Callback, req: Request, code = 0): Promise<void> {
    const res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };

    await callbacks[method](req, res as unknown as Response);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json.mock.calls).toEqual([ [ { code } ] ]);
  }

  function expectReceipt(amount: number): void {
    expect(callbacks.receiptApi.createReceipt).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      email: 'callback@example.test',
      Items: [ expect.objectContaining({
        amount,
        price: amount,
        quantity: 1,
      }) ],
    }));
  }

  test('/check uses the usual factory and provider transaction ID without reserving promo usage', async () => {
    const attempt = await payment();
    const create = jest.spyOn(factories.businessOperationsFactory, 'create');

    await invoke('check', attempt.req);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      transactionId: '1001',
      type: BusinessOperationType.WorkspacePlanPurchase,
      status: BusinessOperationStatus.Pending,
      payload: expect.objectContaining({
        workspaceId,
        tariffPlanId: attempt.planId,
        amount: 8000,
        currency: 'RUB',
      }),
    }));
    expect(await db.collection('businessOperations').countDocuments()).toBe(1);
    expect(await db.collection('promoCodeRedemptions').countDocuments()).toBe(0);
  });

  test('/check creates an operation that the matching /pay can complete', async () => {
    const attempt = await payment();

    await invoke('check', attempt.req);
    await invoke('pay', attempt.req);
    expect(await db.collection('businessOperations').findOne({ transactionId: '1001' })).toMatchObject({
      status: BusinessOperationStatus.Confirmed,
      payload: { userId },
    });
    expect(await db.collection('promoCodeRedemptions').countDocuments()).toBe(1);
    expectReceipt(80);
  });

  test('same widget checksum can /check a new transaction after a failed attempt', async () => {
    const attempt = await payment();

    await invoke('check', attempt.req);
    await invoke('fail', attempt.req);
    attempt.req.body.TransactionId = 1002;
    await invoke('check', attempt.req);
    expect(JSON.parse(attempt.req.body.Data).checksum).toBe(attempt.checksum);
    expect(await db.collection('businessOperations').find({}, {
      projection: {
        transactionId: 1,
        status: 1,
        _id: 0,
      },
    })
      .sort({ transactionId: 1 })
      .toArray()).toEqual([
      {
        transactionId: '1001',
        status: BusinessOperationStatus.Rejected,
      },
      {
        transactionId: '1002',
        status: BusinessOperationStatus.Pending,
      },
    ]);
    expect(await db.collection('promoCodeRedemptions').countDocuments()).toBe(0);
  });

  test.each([
    ['amount', { Amount: '79' }, CheckCodes.WRONG_AMOUNT],
    ['currency', { Currency: 'USD' }, CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED],
  ])('/check rejects invalid promo %s', async (_name, changes, code) => {
    const attempt = await payment();

    Object.assign(attempt.req.body, changes);
    await invoke('check', attempt.req, code as number);
    expect(await db.collection('businessOperations').countDocuments()).toBe(0);
    expect(await db.collection('promoCodeRedemptions').countDocuments()).toBe(0);
  });

  test.each([
    ['disabled', { isDisabled: true } ],
    ['another plan', { planIds: [ new ObjectId() ] } ],
    ['no allowed plans', { planIds: [] } ],
  ])('/check rejects a promo that is now %s', async (_name, changes) => {
    const attempt = await payment();

    await db.collection('promoCodes').updateOne({ _id: attempt.promoCodeId }, { $set: changes });
    await invoke('check', attempt.req, CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED);
    expect(await db.collection('businessOperations').countDocuments()).toBe(0);
  });

  test('/check rejects a deleted promo', async () => {
    const attempt = await payment();

    await db.collection('promoCodes').deleteOne({ _id: attempt.promoCodeId });
    await invoke('check', attempt.req, CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED);
    expect(await db.collection('businessOperations').countDocuments()).toBe(0);
  });

  test.each([
    ['full price', {}, 0],
    ['discounted renewal', { amount: 80 }, CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED],
    ['wrong interval', { interval: 'Day' }, CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED],
    ['wrong period', { period: 2 }, CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED],
    ['wrong start date', { startDate: '2026-12-13T12:00:00.000Z' }, CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED],
  ])('/check validates promo recurrence: %s', async (_name, changes, code) => {
    const attempt = await payment();

    attempt.req.body.Data = JSON.stringify({
      checksum: attempt.checksum,
      cloudPayments: {
        recurrent: {
          amount: 100,
          interval: 'Month',
          period: 1,
          startDate: attempt.signedData.nextPaymentDate,
          ...changes,
        },
      },
    });
    await invoke('check', attempt.req, code as number);
    expect(await db.collection('businessOperations').countDocuments()).toBe(code === 0 ? 1 : 0);
  });

  test('/check does not allow recurrence startDate to bypass the discounted first amount', async () => {
    const attempt = await payment();

    attempt.req.body.Amount = '1';
    attempt.req.body.Data = JSON.stringify({
      checksum: attempt.checksum,
      cloudPayments: {
        recurrent: {
          amount: 100,
          interval: 'Month',
          period: 1,
          startDate: attempt.signedData.nextPaymentDate,
        },
      },
    });
    await invoke('check', attempt.req, CheckCodes.WRONG_AMOUNT);
    expect(await db.collection('businessOperations').countDocuments()).toBe(0);
  });

  test('unsigned identity, card-link and promo fields cannot override a signed promo', async () => {
    const attempt = await payment();

    attempt.req.body.Data = JSON.stringify({
      checksum: attempt.checksum,
      workspaceId: new ObjectId().toString(),
      userId: new ObjectId().toString(),
      tariffPlanId: new ObjectId().toString(),
      isCardLinkOperation: true,
      promo: {
        promoCodeId: new ObjectId().toString(),
        originalAmount: 100,
        finalAmount: 1,
      },
    });
    await invoke('check', attempt.req);
    expect(await db.collection('businessOperations').findOne({ transactionId: '1001' })).toMatchObject({
      type: BusinessOperationType.WorkspacePlanPurchase,
      payload: {
        workspaceId,
        tariffPlanId: attempt.planId,
        amount: 8000,
      },
    });
    attempt.req.body.TransactionId = 1002;
    attempt.req.body.Amount = '1';
    await invoke('check', attempt.req, CheckCodes.WRONG_AMOUNT);
    expect(await db.collection('businessOperations').countDocuments()).toBe(1);
  });

  test('unsigned identity cannot override an ordinary signed purchase', async () => {
    const attempt = await payment(false);
    const changePlan = jest.spyOn(WorkspaceModel.prototype, 'changePlan');
    const userLookup = jest.spyOn(factories.usersFactory, 'findById');

    attempt.req.body.Data = JSON.stringify({
      checksum: attempt.checksum,
      workspaceId: new ObjectId().toString(),
      userId: new ObjectId().toString(),
      tariffPlanId: new ObjectId().toString(),
      isCardLinkOperation: true,
      cloudPayments: {
        recurrent: {
          amount: 100,
          interval: 'Month',
          period: 1,
          startDate: attempt.signedData.nextPaymentDate,
        },
      },
    });
    await invoke('check', attempt.req);
    expect(await db.collection('businessOperations').findOne({ transactionId: '1001' })).toMatchObject({
      type: BusinessOperationType.WorkspacePlanPurchase,
      status: BusinessOperationStatus.Pending,
      payload: {
        workspaceId,
        tariffPlanId: attempt.planId,
        amount: 10000,
      },
    });
    await invoke('pay', attempt.req);
    expect(userLookup).toHaveBeenCalledWith(userId.toString());
    expect(changePlan).toHaveBeenCalledWith(attempt.planId);
    expect(await db.collection('businessOperations').findOne({ transactionId: '1001' })).toMatchObject({
      status: BusinessOperationStatus.Confirmed,
    });
    expect(await db.collection('workspaces').findOne({ _id: workspaceId })).toMatchObject({
      tariffPlanId: attempt.planId,
      subscriptionId: 'sub-new',
    });
    expectReceipt(100);
    expect(sendNotification).toHaveBeenCalledWith(expect.objectContaining({ _id: userId }), {
      type: SenderWorkerTaskType.PaymentSuccess,
      payload: {
        workspaceId: workspaceId.toString(),
        tariffPlanId: attempt.planId.toString(),
        userId: userId.toString(),
      },
    });
    expect(sendMessage).toHaveBeenCalledWith(
      expect.stringContaining(`next payment date: ${attempt.signedData.nextPaymentDate}`),
      TelegramBotURLs.Money
    );
    expect(await db.collection('promoCodeRedemptions').countDocuments()).toBe(0);
  });

  test('unsigned promo cannot discount an ordinary signed purchase', async () => {
    const attempt = await payment(false);

    attempt.req.body.Data = JSON.stringify({
      checksum: attempt.checksum,
      promo: {
        promoCodeId: new ObjectId().toString(),
        originalAmount: 100,
        finalAmount: 80,
      },
    });
    attempt.req.body.Amount = '80';
    await invoke('check', attempt.req, CheckCodes.WRONG_AMOUNT);
    expect(await db.collection('businessOperations').countDocuments()).toBe(0);
  });

  test('/pay redeems, follows the normal plan/subscription flow and reports the actual receipt amount', async () => {
    const attempt = await payment();
    const operation = await pending(attempt);
    const changePlan = jest.spyOn(WorkspaceModel.prototype, 'changePlan');
    const started = Date.now();

    await invoke('pay', attempt.req);
    expect(changePlan).toHaveBeenCalledWith(attempt.planId);
    expect(callbacks.clientApi.cancelSubscription).toHaveBeenCalledWith({ Id: 'sub-old' });
    expect(await db.collection('workspaces').findOne({ _id: workspaceId })).toMatchObject({
      tariffPlanId: attempt.planId,
      subscriptionId: 'sub-new',
      billingPeriodEventsCount: 0,
      lastChargeDate: expect.any(Date),
    });
    const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });

    expect(workspace!.lastChargeDate.getTime()).toBeGreaterThanOrEqual(started);
    expect(await db.collection('businessOperations').findOne({ _id: operation._id })).toMatchObject({ status: BusinessOperationStatus.Confirmed });
    expect(await db.collection('promoCodeRedemptions').findOne({ promoCodeId: attempt.promoCodeId })).toMatchObject({
      userId,
      workspaceId,
      tariffPlanId: attempt.planId,
      transactionId: '1001',
      originalAmount: 100,
      finalAmount: 80,
    });
    expectReceipt(80);
    expect(publish).toHaveBeenCalledWith('cron-tasks', 'cron-tasks/limiter', JSON.stringify({
      type: 'unblock-workspace',
      workspaceId: workspaceId.toString(),
    }));
    expect(sendNotification).toHaveBeenCalledWith(expect.objectContaining({ _id: userId }), {
      type: SenderWorkerTaskType.PaymentSuccess,
      payload: {
        workspaceId: workspaceId.toString(),
        tariffPlanId: attempt.planId.toString(),
        userId: userId.toString(),
      },
    });
    expect(sendMessage).toHaveBeenCalledWith(expect.stringMatching(/\[Billing \/ Pay\][\s\S]*amount: 80 RUB/), TelegramBotURLs.Money);
    expect(HawkCatcher.send).not.toHaveBeenCalled();

    /*
     * Redemption is idempotent; callback side effects deliberately have no such guarantee.
     */
    await invoke('pay', attempt.req);
    expect(await db.collection('promoCodeRedemptions').countDocuments()).toBe(1);
  });

  test.each(['before insert', 'after insert'] as const)(
    '/pay retries a redemption persistence failure %s without fulfilling prematurely', async failure => {
      const attempt = await payment();
      const operation = await pending(attempt);
      const before = await db.collection('workspaces').findOne({ _id: workspaceId });
      const changePlan = jest.spyOn(WorkspaceModel.prototype, 'changePlan');
      const realRedeem = factories.promoCodeRedemptionsFactory.redeem.bind(factories.promoCodeRedemptionsFactory);
      const redeem = jest.spyOn(factories.promoCodeRedemptionsFactory, 'redeem').mockImplementationOnce(async paymentData => {
        if (failure === 'after insert') {
          await realRedeem(paymentData);
        }
        throw new Error('Redemption database unavailable');
      });
      const res = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
      };

      await callbacks.pay(attempt.req, res as unknown as Response);
      expect(res.status.mock.calls).toEqual([ [ 500 ] ]);
      expect(res.json.mock.calls).toEqual([ [ { code: 1 } ] ]);
      expect(await db.collection('businessOperations').findOne({ _id: operation._id })).toMatchObject({
        status: BusinessOperationStatus.Pending,
      });
      expect(await db.collection('workspaces').findOne({ _id: workspaceId })).toEqual(before);
      expect(changePlan).not.toHaveBeenCalled();
      expect(callbacks.receiptApi.createReceipt).not.toHaveBeenCalled();
      expect(callbacks.clientApi.cancelSubscription).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
      expect(sendNotification).not.toHaveBeenCalled();
      const persisted = await db.collection('promoCodeRedemptions').find({})
        .toArray();

      expect(persisted).toHaveLength(failure === 'after insert' ? 1 : 0);
      const errorMessage = '[Billing / Pay] Could not redeem promo code: Error: Redemption database unavailable';

      expect(HawkCatcher.send).toHaveBeenCalledWith(new Error(errorMessage), attempt.req.body);
      expect(sendMessage).toHaveBeenCalledWith(expect.stringContaining(errorMessage), TelegramBotURLs.Money);

      await invoke('pay', attempt.req);
      expect(redeem).toHaveBeenCalledTimes(2);
      expect(redeem.mock.calls[1]).toEqual(redeem.mock.calls[0]);
      expect(await db.collection('businessOperations').findOne({ _id: operation._id })).toMatchObject({
        status: BusinessOperationStatus.Confirmed,
      });
      expect(changePlan).toHaveBeenCalledTimes(1);
      expect(changePlan).toHaveBeenCalledWith(attempt.planId);
      expect(await db.collection('workspaces').findOne({ _id: workspaceId })).toMatchObject({
        tariffPlanId: attempt.planId,
        subscriptionId: 'sub-new',
        billingPeriodEventsCount: 0,
      });
      expectReceipt(80);
      expect(callbacks.receiptApi.createReceipt).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledTimes(1);
      expect(sendNotification).toHaveBeenCalledTimes(1);
      expect(await db.collection('promoCodeRedemptions').countDocuments()).toBe(1);
      expect(await db.collection('promoCodeRedemptions').findOne({ transactionId: '1001' })).toMatchObject({
        promoCodeId: attempt.promoCodeId,
        userId,
        workspaceId,
        tariffPlanId: attempt.planId,
        originalAmount: 100,
        finalAmount: 80,
      });
      if (failure === 'after insert') {
        expect(await db.collection('promoCodeRedemptions').find({})
          .toArray()).toEqual(persisted);
      }
    }
  );

  test.each([
    ['amount', { 'payload.amount': 7900 } ],
    ['currency', { 'payload.currency': 'USD' } ],
    ['workspace', { 'payload.workspaceId': new ObjectId() } ],
    ['payer', { 'payload.userId': new ObjectId() } ],
    ['plan', { 'payload.tariffPlanId': new ObjectId() } ],
    ['operation type', { type: BusinessOperationType.CardLinkCharge } ],
  ])('/pay rejects a mismatched operation %s before redeeming or changing the plan', async (_name, changes) => {
    const attempt = await payment();
    const operation = await pending(attempt);
    const changePlan = jest.spyOn(WorkspaceModel.prototype, 'changePlan');

    await db.collection('businessOperations').updateOne({ _id: operation._id }, { $set: changes });
    await invoke('pay', attempt.req);
    expect(await db.collection('promoCodeRedemptions').countDocuments()).toBe(0);
    expect(await db.collection('businessOperations').findOne({ _id: operation._id })).toMatchObject({ status: BusinessOperationStatus.Pending });
    expect(changePlan).not.toHaveBeenCalled();
    expect(callbacks.receiptApi.createReceipt).not.toHaveBeenCalled();
    expect(HawkCatcher.send).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Invalid promo payment') }), attempt.req.body);
  });

  test('/fail rejects the operation without consumption or plan changes and retains monitoring', async () => {
    const attempt = await payment();
    const operation = await pending(attempt);
    const before = await db.collection('workspaces').findOne({ _id: workspaceId });
    const redeem = jest.spyOn(factories.promoCodeRedemptionsFactory, 'redeem');

    await invoke('fail', attempt.req);
    expect(await db.collection('businessOperations').findOne({ _id: operation._id })).toMatchObject({ status: BusinessOperationStatus.Rejected });
    expect(await db.collection('workspaces').findOne({ _id: workspaceId })).toEqual(before);
    expect(redeem).not.toHaveBeenCalled();
    expect(await db.collection('promoCodeRedemptions').countDocuments()).toBe(0);
    expect(callbacks.receiptApi.createReceipt).not.toHaveBeenCalled();
    expect(callbacks.clientApi.cancelSubscription).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(sendNotification).toHaveBeenCalledWith(expect.objectContaining({ _id: userId }), {
      type: SenderWorkerTaskType.PaymentFailed,
      payload: {
        workspaceId: workspaceId.toString(),
        reason: ReasonCodesTranscript[ReasonCode.DO_NOT_HONOR],
      },
    });
    expect(sendMessage).toHaveBeenCalledWith(expect.stringMatching(/\[Billing \/ Fail\][\s\S]*amount: 80 RUB[\s\S]*transaction id: 1001/), TelegramBotURLs.Money);
    expect(HawkCatcher.send).toHaveBeenCalledWith(new Error('[Billing / Fail] Transaction failed'), attempt.req.body);
  });

  test.each(['pay', 'fail'] as const)('expired promo checksum is rejected by /check but accepted by /%s for an existing operation', async method => {
    const attempt = await payment();
    const operation = await pending(attempt);

    attempt.req.body.Data = JSON.stringify({ checksum: jwt.sign(attempt.signedData, SECRET, { expiresIn: -1 }) });
    await invoke('check', attempt.req, CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED);
    expect(await db.collection('businessOperations').countDocuments()).toBe(1);
    await invoke(method, attempt.req);
    expect(await db.collection('businessOperations').findOne({ _id: operation._id })).toMatchObject({
      status: method === 'pay' ? BusinessOperationStatus.Confirmed : BusinessOperationStatus.Rejected,
    });
    expect(await db.collection('promoCodeRedemptions').countDocuments()).toBe(method === 'pay' ? 1 : 0);
  });

  test('ordinary cancellation Success:false still sends the receipt and unblocks the workspace', async () => {
    const attempt = await payment(false);
    const operation = await pending(attempt);

    callbacks.clientApi.cancelSubscription.mockResolvedValueOnce({
      Success: false,
      isSuccess: (): boolean => false,
    });
    await invoke('pay', attempt.req);
    expect(callbacks.clientApi.cancelSubscription).toHaveBeenCalledWith({ Id: 'sub-old' });
    expect(await db.collection('businessOperations').findOne({ _id: operation._id })).toMatchObject({ status: BusinessOperationStatus.Confirmed });
    expect(await db.collection('workspaces').findOne({ _id: workspaceId })).toMatchObject({
      subscriptionId: 'sub-new',
      tariffPlanId: attempt.planId,
    });
    expectReceipt(100);
    expect(publish).toHaveBeenCalled();
    expect(sendNotification).toHaveBeenCalled();
    expect(await db.collection('promoCodeRedemptions').countDocuments()).toBe(0);
  });

  test('ordinary payment with older dtCreated still calls changePlan and resets the billing period', async () => {
    const attempt = await payment(false);

    await pending(attempt, new Date(PAYMENT_DATE.getTime() - 86400000));
    const changePlan = jest.spyOn(WorkspaceModel.prototype, 'changePlan');
    const started = Date.now();

    await invoke('pay', attempt.req);
    expect(changePlan).toHaveBeenCalledWith(attempt.planId);
    const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });

    expect(workspace).toMatchObject({
      tariffPlanId: attempt.planId,
      billingPeriodEventsCount: 0,
    });
    expect(workspace!.lastChargeDate.getTime()).toBeGreaterThanOrEqual(started);
    expectReceipt(100);
  });

  test('a later recurring charge without widget data uses the ordinary full-price flow', async () => {
    const attempt = await payment(false);

    await db.collection('workspaces').updateOne({ _id: workspaceId }, { $set: { tariffPlanId: attempt.planId } });
    delete attempt.req.body.Data;
    attempt.req.body.SubscriptionId = 'sub-old';
    attempt.req.body.AccountId = userId.toString();
    await invoke('check', attempt.req);
    await invoke('pay', attempt.req);
    expectReceipt(100);
    expect(callbacks.clientApi.cancelSubscription).not.toHaveBeenCalled();
    expect(await db.collection('promoCodeRedemptions').countDocuments()).toBe(0);
    expect(await db.collection('workspaces').findOne({ _id: workspaceId })).toMatchObject({
      billingPeriodEventsCount: 0,
      subscriptionId: 'sub-old',
    });
  });

  test.each([SubscriptionStatus.CANCELLED, SubscriptionStatus.REJECTED, SubscriptionStatus.ACTIVE])(
    '/recurrent %s uses the normal workspace model', async status => {
      const lookup = jest.spyOn(factories.workspacesFactory, 'findBySubscriptionId');
      const setSubscription = jest.spyOn(WorkspaceModel.prototype, 'setSubscriptionId');
      const req = {
        body: {
          Id: 'sub-old',
          Status: status,
        },
        context: { factories },
      } as unknown as Request;

      await invoke('recurrent', req);
      expect(lookup).toHaveBeenCalledWith('sub-old');
      const workspace = await db.collection('workspaces').findOne({ _id: workspaceId });

      if (status === SubscriptionStatus.ACTIVE) {
        expect(setSubscription).not.toHaveBeenCalled();
        expect(workspace!.subscriptionId).toBe('sub-old');
      } else {
        expect(setSubscription).toHaveBeenCalledWith(null);
        expect(workspace!.subscriptionId).toBeFalsy();
      }
      expect(HawkCatcher.send).toHaveBeenCalledWith(new Error(`[Billing / Recurrent] New recurrent event with ${status} status`), req.body);
    }
  );
});
