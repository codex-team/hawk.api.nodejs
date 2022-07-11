import { accountingEnv, apiInstance } from '../../utils';
import { PayCodes, PayRequest } from '../../../../src/billing/types';
import { CardType, Currency, OperationStatus, OperationType } from '../../../../src/billing/types/enums';
import { Collection, Db, ObjectId } from 'mongodb';
import {
  BusinessOperationDBScheme,
  BusinessOperationStatus,
  BusinessOperationType,
  PlanDBScheme,
  UserDBScheme,
  WorkspaceDBScheme
} from '@hawk.so/types';
import {
  PaymentSuccessNotificationPayload,
  PaymentSuccessNotificationTask,
  SenderWorkerTaskType
} from '../../../../src/types/personalNotifications';
import { WorkerPaths } from '../../../../src/rabbitmq';
import checksumService from '../../../../src/utils/checksumService';
import { getRequestWithSubscription, user } from '../../billingMocks';
import { CardDetails } from '../../../../src/billing/types/cardDetails';

const transactionId = 123456;

const currentPlan: PlanDBScheme = {
  _id: new ObjectId(),
  eventsLimit: 1000,
  isDefault: true,
  monthlyCharge: 1000,
  name: 'Test plan',
};

const cardDetails: Required<CardDetails> = {
  CardExpDate: '25/03',
  CardType: CardType.VISA,
  Token: '123123',
  CardFirstSix: '545636',
  CardLastFour: '4555',
};

const workspace = {
  _id: new ObjectId(),
  accountId: '123',
  balance: 0,
  billingPeriodEventsCount: 1000,
  lastChargeDate: new Date(2020, 10, 4),
  name: 'Test workspace',
  tariffPlanId: currentPlan._id,
  inviteHash: '123456789',
};

const workspaceAccount = {
  id: workspace.accountId,
  name: 'WORKSPACE:' + workspace.name,
  type: 'Liability',
  currency: 'USD',
  dtCreated: Date.now(),
};

const planToChange: PlanDBScheme = {
  _id: new ObjectId(),
  eventsLimit: 10000,
  isDefault: true,
  monthlyCharge: 100,
  name: 'Test plan',
};

const cashbookAccount = {
  id: accountingEnv.CASHBOOK_ACCOUNT_ID,
  name: accountingEnv.CASHBOOK_ACCOUNT_NAME,
  type: 'Asset',
  currency: 'USD',
  dtCreated: Date.now(),
};

const revenueAccount = {
  id: accountingEnv.REVENUE_ACCOUNT_ID,
  name: accountingEnv.REVENUE_ACCOUNT_NAME,
  type: 'Revenue',
  currency: 'USD',
  dtCreated: Date.now(),
};

const paymentSuccessPayload: PaymentSuccessNotificationPayload = {
  userId: user._id.toString(),
  workspaceId: workspace._id.toString(),
  tariffPlanId: planToChange._id.toString(),
};

/**
 * Valid data to send to `pay` webhook
 * Initializes later in beforeAll
 */
let validPayRequestData: PayRequest;

describe('Pay webhook', () => {
  let accountsDb: Db;
  let accountingDb: Db;
  let usersCollection: Collection<UserDBScheme>;
  let businessOperationsCollection: Collection<BusinessOperationDBScheme>;
  let workspacesCollection: Collection<WorkspaceDBScheme>;
  let tariffPlanCollection: Collection<PlanDBScheme>;
  let accountingCollection: Collection;
  let transactionsCollection: Collection;

  beforeAll(async () => {
    validPayRequestData = {
      Amount: '10',
      CardExpDate: '06/25',
      CardFirstSix: '578946',
      CardLastFour: '5367',
      CardType: CardType.VISA,
      Currency: Currency.RUB,
      DateTime: new Date(),
      GatewayName: 'CodeX bank',
      OperationType: OperationType.PAYMENT,
      Status: OperationStatus.COMPLETED,
      TestMode: false,
      TotalFee: 0,
      TransactionId: transactionId,
      Data: JSON.stringify({
        checksum: await checksumService.generateChecksum({
          ...paymentSuccessPayload,
          shouldSaveCard: false,
        }),
      }),
    };

    accountsDb = await global.mongoClient.db('hawk');
    accountingDb = await global.mongoClient.db('codex_accounting');

    usersCollection = accountsDb.collection('users');
    businessOperationsCollection = accountsDb.collection('businessOperations');
    workspacesCollection = accountsDb.collection('workspaces');
    tariffPlanCollection = accountsDb.collection('plans');

    transactionsCollection = accountingDb.collection('transactions');
    accountingCollection = accountingDb.collection('accounts');
  });

  beforeEach(async () => {
    /**
     * Add user who makes payment
     */
    await usersCollection.insertOne(user);

    /**
     * Add pending business operation to database (like after /billing/check route)
     */
    await businessOperationsCollection.insertOne({
      transactionId: transactionId.toString(),
      type: BusinessOperationType.DepositByUser,
      status: BusinessOperationStatus.Pending,
      dtCreated: new Date(),
      payload: {
        workspaceId: new ObjectId(),
        amount: 10,
        userId: user._id,
        cardPan: '2456',
      },
    });

    /**
     * Add workspace for testing it
     */
    await workspacesCollection.insertOne(workspace);

    /**
     * Add tariff plans for testing
     */
    await tariffPlanCollection.insertOne(currentPlan);
    await tariffPlanCollection.insertOne(planToChange);

    /**
     * Add necessary accounts to accounting system
     */
    await accountingCollection.insertMany([cashbookAccount, revenueAccount, workspaceAccount]);
  });

  afterEach(async () => {
    await accountsDb.dropDatabase();
    await accountingDb.dropDatabase();
    await global.rabbitChannel.purgeQueue(WorkerPaths.Limiter.queue);
    await global.rabbitChannel.purgeQueue(WorkerPaths.Email.queue);
  });

  describe('With SubscriptionId field only', () => {
    const request = getRequestWithSubscription(user._id.toString());

    request.TransactionId = transactionId;

    beforeEach(async () => {
      await workspacesCollection.updateOne(
        { _id: workspace._id },
        { $set: { subscriptionId: request.SubscriptionId } }
      );
    });

    test('Should change business operation status to confirmed', async () => {
      const apiResponse = await apiInstance.post('/billing/pay', request);

      const updatedBusinessOperation = await businessOperationsCollection.findOne({
        transactionId: transactionId.toString(),
      });

      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
      expect(updatedBusinessOperation?.status).toBe(BusinessOperationStatus.Confirmed);
    });

    test('Should reset events counter in workspace', async () => {
      const apiResponse = await apiInstance.post('/billing/pay', request);

      const updatedWorkspace = await workspacesCollection.findOne({
        _id: workspace._id,
      });

      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
      expect(updatedWorkspace?.billingPeriodEventsCount).toBe(0);
    });

    test('Should reset last charge date in workspace', async () => {
      const apiResponse = await apiInstance.post('/billing/pay', request);

      const updatedWorkspace = await workspacesCollection.findOne({
        _id: workspace._id,
      });

      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
      expect(updatedWorkspace?.lastChargeDate).not.toBe(workspace.lastChargeDate);
    });

    test('Should send task to limiter worker to check workspace', async () => {
      const apiResponse = await apiInstance.post('/billing/pay', request);

      const message = await global.rabbitChannel.get('cron-tasks/limiter', {
        noAck: true,
      });
      const expectedLimiterTask = {
        type: 'check-single-workspace',
        workspaceId: workspace._id.toString(),
      };

      expect(message).toBeTruthy();
      expect(message && JSON.parse(message.content.toString())).toStrictEqual(expectedLimiterTask);
      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
    });

    test('Should associate an account with a workspace if the workspace did not have one', async () => {
      /**
       * Remove accountId from existed workspace
       */
      await workspacesCollection.updateOne(
        { _id: workspace._id },
        {
          $unset: {
            accountId: '',
          },
        }
      );

      const apiResponse = await apiInstance.post('/billing/pay', request);

      /**
       * Check that account is created and linked
       */
      const updatedWorkspace = await workspacesCollection.findOne({ _id: workspace._id });
      const accountId = updatedWorkspace?.accountId;
      const account = await accountingCollection.findOne({ id: accountId });

      expect(typeof accountId).toBe('string');
      expect(account).toBeTruthy();
      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
    });

    test('Should add payment data to accounting system', async () => {
      const apiResponse = await apiInstance.post('/billing/pay', request);

      const transactions = await transactionsCollection
        .find({})
        .toArray();

      expect(transactions.length).toBe(2);
      expect(transactions.some(tr => tr.type === 'Deposit'));
      expect(transactions.some(tr => tr.type === 'Purchase'));
      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
    });

    test('Should add task to sender worker to notify user about successful payment', async () => {
      const apiResponse = await apiInstance.post('/billing/pay', request);

      const message = await global.rabbitChannel.get(WorkerPaths.Email.queue, {
        noAck: true,
      });
      const expectedLimiterTask: PaymentSuccessNotificationTask = {
        type: SenderWorkerTaskType.PaymentSuccess,
        payload: {
          endpoint: 'test@hawk.so',
          userId: user._id.toString(),
          workspaceId: workspace._id.toString(),
          tariffPlanId: currentPlan._id.toString(),
        },
      };

      expect(message).toBeTruthy();
      expect(message && JSON.parse(message.content.toString())).toStrictEqual(expectedLimiterTask);
      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
    });
  });

  describe('With valid request', () => {
    test('Should change business operation status to confirmed', async () => {
      const apiResponse = await apiInstance.post('/billing/pay', validPayRequestData);

      const updatedBusinessOperation = await businessOperationsCollection.findOne({
        transactionId: transactionId.toString(),
      });

      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
      expect(updatedBusinessOperation?.status).toBe(BusinessOperationStatus.Confirmed);
    });

    test('Should reset events counter in workspace', async () => {
      const apiResponse = await apiInstance.post('/billing/pay', validPayRequestData);

      const updatedWorkspace = await workspacesCollection.findOne({
        _id: workspace._id,
      });

      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
      expect(updatedWorkspace?.billingPeriodEventsCount).toBe(0);
    });

    test('Should reset last charge date in workspace', async () => {
      const apiResponse = await apiInstance.post('/billing/pay', validPayRequestData);

      const updatedWorkspace = await workspacesCollection.findOne({
        _id: workspace._id,
      });

      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
      expect(updatedWorkspace?.lastChargeDate).not.toBe(workspace.lastChargeDate);
    });

    test('Should change workspace plan', async () => {
      const apiResponse = await apiInstance.post('/billing/pay', validPayRequestData);

      const updatedWorkspace = await workspacesCollection.findOne({
        _id: workspace._id,
      });

      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
      expect(updatedWorkspace?.tariffPlanId.toString()).toBe(planToChange._id.toString());
    });

    test('Should send task to limiter worker to check workspace', async () => {
      const apiResponse = await apiInstance.post('/billing/pay', validPayRequestData);

      const message = await global.rabbitChannel.get('cron-tasks/limiter', {
        noAck: true,
      });
      const expectedLimiterTask = {
        type: 'check-single-workspace',
        workspaceId: workspace._id.toString(),
      };

      expect(message).toBeTruthy();
      expect(message && JSON.parse(message.content.toString())).toStrictEqual(expectedLimiterTask);
      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
    });

    test('Should associate an account with a workspace if the workspace did not have one', async () => {
      /**
       * Remove accountId from existed workspace
       */
      await workspacesCollection.updateOne(
        { _id: workspace._id },
        {
          $unset: {
            accountId: '',
          },
        }
      );

      const apiResponse = await apiInstance.post('/billing/pay', validPayRequestData);

      /**
       * Check that account is created and linked
       */
      const updatedWorkspace = await workspacesCollection.findOne({ _id: workspace._id });
      const accountId = updatedWorkspace?.accountId;
      const account = await accountingCollection.findOne({ id: accountId });

      expect(typeof accountId).toBe('string');
      expect(account).toBeTruthy();
      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
    });

    test('Should add payment data to accounting system', async () => {
      const apiResponse = await apiInstance.post('/billing/pay', validPayRequestData);

      const transactions = await transactionsCollection
        .find({})
        .toArray();

      expect(transactions.length).toBe(2);
      expect(transactions.some(tr => tr.type === 'Deposit'));
      expect(transactions.some(tr => tr.type === 'Purchase'));
      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
    });

    test('Should add task to sender worker to notify user about successful payment', async () => {
      const apiResponse = await apiInstance.post('/billing/pay', validPayRequestData);

      const message = await global.rabbitChannel.get(WorkerPaths.Email.queue, {
        noAck: true,
      });
      const expectedLimiterTask: PaymentSuccessNotificationTask = {
        type: SenderWorkerTaskType.PaymentSuccess,
        payload: {
          endpoint: 'test@hawk.so',
          ...paymentSuccessPayload,
        },
      };

      expect(message).toBeTruthy();
      expect(message && JSON.parse(message.content.toString())).toStrictEqual(expectedLimiterTask);
      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
    });

    test('Should save SubscriptionId if it is provided in request', async () => {
      const request = {
        ...validPayRequestData,
        SubscriptionId: '123',
      };

      const apiResponse = await apiInstance.post('/billing/pay', request);

      const updatedWorkspace = await workspacesCollection.findOne({ _id: workspace._id });

      expect(updatedWorkspace?.subscriptionId).toBe(request.SubscriptionId);
      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
    });
  });

  describe('With invalid request', () => {
    test('Should not change business operation status if no data or subscription id provided', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { Data, ...invalidRequest } = validPayRequestData;
      const apiResponse = await apiInstance.post('/billing/pay', invalidRequest);

      const updatedBusinessOperation = await businessOperationsCollection.findOne({
        transactionId: transactionId.toString(),
      });

      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
      expect(updatedBusinessOperation?.status).toBe(BusinessOperationStatus.Pending);
    });

    test('Should not change business operation status if no workspace id provided', async () => {
      const apiResponse = await apiInstance.post('/billing/pay', {
        ...validPayRequestData,
        Data: JSON.stringify({
          checksum: await checksumService.generateChecksum({
            userId: user._id.toString(),
            workspaceId: '',
            tariffPlanId: planToChange._id.toString(),
            shouldSaveCard: false,
          }),
        }),
      });

      const updatedBusinessOperation = await businessOperationsCollection.findOne({
        transactionId: transactionId.toString(),
      });

      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
      expect(updatedBusinessOperation?.status).toBe(BusinessOperationStatus.Pending);
    });

    test('Should not change business operation status if no user id provided', async () => {
      const apiResponse = await apiInstance.post('/billing/pay', {
        ...validPayRequestData,
        Data: JSON.stringify({
          checksum: await checksumService.generateChecksum({
            userId: '',
            workspaceId: workspace._id.toString(),
            tariffPlanId: planToChange._id.toString(),
            shouldSaveCard: false,
          }),
        }),
      });

      const updatedBusinessOperation = await businessOperationsCollection.findOne({
        transactionId: transactionId.toString(),
      });

      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
      expect(updatedBusinessOperation?.status).toBe(BusinessOperationStatus.Pending);
    });

    test('Should not change business operation status if no tariff plan id provided', async () => {
      const apiResponse = await apiInstance.post('/billing/pay', {
        ...validPayRequestData,
        Data: JSON.stringify({
          checksum: await checksumService.generateChecksum({
            userId: user._id.toString(),
            workspaceId: workspace._id.toString(),
            tariffPlanId: '',
            shouldSaveCard: false,
          }),
        }),
      });

      const updatedBusinessOperation = await businessOperationsCollection.findOne({
        transactionId: transactionId.toString(),
      });

      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
      expect(updatedBusinessOperation?.status).toBe(BusinessOperationStatus.Pending);
    });

    test('Should not change business operation status if no workspaces with provided id', async () => {
      const apiResponse = await apiInstance.post('/billing/pay', {
        ...validPayRequestData,
        Data: JSON.stringify({
          checksum: await checksumService.generateChecksum({
            userId: user._id.toString(),
            workspaceId: new ObjectId().toString(),
            tariffPlanId: planToChange._id.toString(),
            shouldSaveCard: false,
          }),
        }),
      });

      const updatedBusinessOperation = await businessOperationsCollection.findOne({
        transactionId: transactionId.toString(),
      });

      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
      expect(updatedBusinessOperation?.status).toBe(BusinessOperationStatus.Pending);
    });

    test('Should not change business operation status if no tariff plan with provided id', async () => {
      const apiResponse = await apiInstance.post('/billing/pay', {
        ...validPayRequestData,
        Data: JSON.stringify({
          checksum: await checksumService.generateChecksum({
            userId: new ObjectId().toString(),
            workspaceId: workspace._id.toString(),
            tariffPlanId: new ObjectId().toString(),
            shouldSaveCard: false,
          }),
        }),
      });

      const updatedBusinessOperation = await businessOperationsCollection.findOne({
        transactionId: transactionId.toString(),
      });

      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
      expect(updatedBusinessOperation?.status).toBe(BusinessOperationStatus.Pending);
    });

    test('Should not change business operation status if no user with provided id', async () => {
      const apiResponse = await apiInstance.post('/billing/pay', {
        ...validPayRequestData,
        Data: JSON.stringify({
          checksum: await checksumService.generateChecksum({
            userId: new ObjectId().toString(),
            workspaceId: workspace._id.toString(),
            tariffPlanId: planToChange._id.toString(),
            shouldSaveCard: false,
          }),
        }),
      });

      const updatedBusinessOperation = await businessOperationsCollection.findOne({
        transactionId: transactionId.toString(),
      });

      expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
      expect(updatedBusinessOperation?.status).toBe(BusinessOperationStatus.Pending);
    });
  });
});
