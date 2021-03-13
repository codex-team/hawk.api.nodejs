import { apiInstance } from '../../utils';
import { FailCodes, FailRequest } from '../../../../src/billing/types';
import { CardType, Currency, OperationType, ReasonCode } from '../../../../src/billing/types/enums';
import { Collection, ObjectId, Db } from 'mongodb';
import { BusinessOperationDBScheme, BusinessOperationStatus, PlanDBScheme, BusinessOperationType, UserDBScheme, WorkspaceDBScheme, UserNotificationType, PlanProlongationPayload } from 'hawk.types';
import { WorkerPaths } from '../../../../src/rabbitmq';
import { PaymentFailedNotificationTask, SenderWorkerTaskType } from '../../../../src/types/personalNotifications';
import checksumService from '../../../../src/utils/checksumService';
import { getRequestWithSubscription } from '../../mocks';

const transactionId = 909090;

const user: UserDBScheme = {
  _id: new ObjectId(),
  notifications: {
    whatToReceive: {
      [UserNotificationType.IssueAssigning]: true,
      [UserNotificationType.SystemMessages]: true,
      [UserNotificationType.WeeklyDigest]: true,
    },
    channels: {
      email: {
        isEnabled: true,
        endpoint: 'test@hawk.so',
        minPeriod: 10,
      },
    },
  },
};

const workspace = {
  _id: new ObjectId(),
  accountId: '123',
  balance: 0,
  billingPeriodEventsCount: 1000,
  lastChargeDate: new Date(2020, 10, 4),
  name: 'Test workspace',
  tariffPlanId: new ObjectId(),
};

const tariffPlan: PlanDBScheme = {
  _id: new ObjectId(),
  eventsLimit: 10000,
  isDefault: true,
  monthlyCharge: 100,
  name: 'Test plan',
};

const planProlongationPayload: PlanProlongationPayload = {
  userId: user._id.toString(),
  workspaceId: workspace._id.toString(),
  tariffPlanId: tariffPlan._id.toString(),
};

const validRequest: FailRequest = {
  Amount: 100,
  CardExpDate: '06/25',
  CardFirstSix: '578946',
  CardLastFour: '5367',
  CardType: CardType.VISA,
  Currency: Currency.USD,
  DateTime: new Date(),
  OperationType: OperationType.PAYMENT,
  TestMode: false,
  TransactionId: transactionId,
  Issuer: 'Codex Bank',
  Reason: 'Stolen card',
  ReasonCode: ReasonCode.DO_NOT_HONOR,
};

describe('Fail webhook', () => {
  let accountsDb: Db;
  let businessOperationsCollection: Collection<BusinessOperationDBScheme>;
  let workspacesCollection: Collection<WorkspaceDBScheme>;
  let usersCollection: Collection<UserDBScheme>;

  beforeAll(async () => {
    accountsDb = await global.mongoClient.db('hawk');

    businessOperationsCollection = await accountsDb.collection<BusinessOperationDBScheme>('businessOperations');
    workspacesCollection = accountsDb.collection('workspaces');
    usersCollection = accountsDb.collection('users');
  });

  beforeEach(async () => {
    /**
     * Add user who makes payment
     */
    await usersCollection.insertOne(user);

    /**
     * Add workspace for testing it
     */
    await workspacesCollection.insertOne(workspace);

    /**
     * Add pending business operation to database (like after /billing/check route)
     */
    await businessOperationsCollection.insertOne({
      transactionId: transactionId.toString(),
      type: BusinessOperationType.DepositByUser,
      status: BusinessOperationStatus.Pending,
      dtCreated: new Date(),
      payload: {
        workspaceId: workspace._id,
        amount: 200,
        userId: user._id,
        cardPan: '5367',
      },
    });

    /**
     * Clear rabbitmq queue
     */
    await global.rabbitChannel.purgeQueue(WorkerPaths.Email.queue);
  });

  afterEach(async () => {
    await accountsDb.dropDatabase();
  });

  describe('With SubscriptionId only', () => {
    const request = getRequestWithSubscription(user._id.toString());

    request.TransactionId = transactionId;

    beforeEach(async () => {
      await workspacesCollection.updateOne(
        { _id: workspace._id },
        { $set: { subscriptionId: request.SubscriptionId } }
      );
    });

    test.only('Should change business operation status to rejected', async () => {
      const apiResponse = await apiInstance.post('/billing/fail', request);

      const updatedBusinessOperation = await businessOperationsCollection.findOne({
        transactionId: transactionId.toString(),
      });

      expect(apiResponse.data.code).toBe(FailCodes.SUCCESS);
      expect(updatedBusinessOperation?.status).toBe(BusinessOperationStatus.Rejected);
    });

    test('Should add task to sender worker to notify user about payment rejection', async () => {
      const apiResponse = await apiInstance.post('/billing/fail', request);

      const message = await global.rabbitChannel.get(WorkerPaths.Email.queue, {
        noAck: true,
      });
      const expectedLimiterTask: PaymentFailedNotificationTask = {
        type: SenderWorkerTaskType.PaymentFailed,
        payload: {
          endpoint: 'test@hawk.so',
          workspaceId: workspace._id.toString(),
          reason: validRequest.Reason,
        },
      };

      expect(message).toBeTruthy();
      expect(message && JSON.parse(message.content.toString())).toStrictEqual(expectedLimiterTask);
      expect(apiResponse.data.code).toBe(FailCodes.SUCCESS);
    });
  });

  describe('With valid request', () => {
    test('Should change business operation status to rejected', async () => {
      const apiResponse = await apiInstance.post('/billing/fail', {
        ...validRequest,
        Data: JSON.stringify({
          checksum: await checksumService.generateChecksum(planProlongationPayload),
        }),
      });

      const updatedBusinessOperation = await businessOperationsCollection.findOne({
        transactionId: transactionId.toString(),
      });

      expect(apiResponse.data.code).toBe(FailCodes.SUCCESS);
      expect(updatedBusinessOperation?.status).toBe(BusinessOperationStatus.Rejected);
    });

    test('Should add task to sender worker to notify user about payment rejection', async () => {
      const apiResponse = await apiInstance.post('/billing/fail', {
        ...validRequest,
        Data: JSON.stringify({
          checksum: await checksumService.generateChecksum(planProlongationPayload),
        }),
      });

      const message = await global.rabbitChannel.get(WorkerPaths.Email.queue, {
        noAck: true,
      });
      const expectedLimiterTask: PaymentFailedNotificationTask = {
        type: SenderWorkerTaskType.PaymentFailed,
        payload: {
          endpoint: 'test@hawk.so',
          workspaceId: workspace._id.toString(),
          reason: validRequest.Reason,
        },
      };

      expect(message).toBeTruthy();
      expect(message && JSON.parse(message.content.toString())).toStrictEqual(expectedLimiterTask);
      expect(apiResponse.data.code).toBe(FailCodes.SUCCESS);
    });
  });

  describe('With invalid request', () => {
    test('Should not change business operation status if no data provided', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { Data, ...invalidRequest } = validRequest;
      const apiResponse = await apiInstance.post('/billing/fail', invalidRequest);

      const updatedBusinessOperation = await businessOperationsCollection.findOne({
        transactionId: transactionId.toString(),
      });

      expect(apiResponse.data.code).toBe(FailCodes.SUCCESS);
      expect(updatedBusinessOperation?.status).toBe(BusinessOperationStatus.Pending);
    });

    test('Should not change business operation status if no user id provided', async () => {
      const apiResponse = await apiInstance.post('/billing/fail', {
        ...validRequest,
        Data: JSON.stringify({
          checksum: await checksumService.generateChecksum({
            userId: '',
            workspaceId: workspace._id.toString(),
            tariffPlanId: tariffPlan._id.toString(),
          }),
        }),
      });

      const updatedBusinessOperation = await businessOperationsCollection.findOne({
        transactionId: transactionId.toString(),
      });

      expect(apiResponse.data.code).toBe(FailCodes.SUCCESS);
      expect(updatedBusinessOperation?.status).toBe(BusinessOperationStatus.Pending);
    });
  });
});
