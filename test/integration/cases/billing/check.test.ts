import { apiInstance } from '../../utils';
import { CheckCodes, CheckRequest } from '../../../../src/billing/types';
import { Collection, Db } from 'mongodb';
import {
  BusinessOperationDBScheme,
  BusinessOperationStatus,
  ConfirmedMemberDBScheme,
  PlanDBScheme,
  UserDBScheme,
  WorkspaceDBScheme
} from '@hawk.so/types';
import checksumService from '../../../../src/utils/checksumService';
import { getRequestWithSubscription, mainRequest, transactionId } from '../../billingMocks';
import type { Global } from '@jest/types';

declare var global: Global.Global;

describe('Check webhook', () => {
  let accountsDb: Db;

  let businessOperationsCollection: Collection<BusinessOperationDBScheme>;
  let workspacesCollection: Collection<WorkspaceDBScheme>;
  let plans: Collection<PlanDBScheme>;
  let users: Collection<UserDBScheme>;

  let workspace: WorkspaceDBScheme;
  let externalUser: UserDBScheme;
  let member: UserDBScheme;
  let admin: UserDBScheme;
  let planToChange: PlanDBScheme;

  beforeAll(async () => {
    accountsDb = await global.mongoClient.db('hawk');

    workspacesCollection = await accountsDb.collection<WorkspaceDBScheme>('workspaces');
    users = await accountsDb.collection<UserDBScheme>('users');
    plans = await accountsDb.collection<PlanDBScheme>('plans');

    businessOperationsCollection = await accountsDb.collection<BusinessOperationDBScheme>('businessOperations');
  });

  beforeEach(async () => {
    const currentPlan = (await plans.insertOne({
      name: 'CurrentTestPlan',
      monthlyCharge: 10,
      monthlyChargeCurrency: 'USD',
      eventsLimit: 1000,
      isDefault: false,
    })).ops[0];

    workspace = (await workspacesCollection.insertOne({
      name: 'BillingTest',
      accountId: '123',
      tariffPlanId: currentPlan._id,
    } as WorkspaceDBScheme)).ops[0];

    externalUser = (await users.insertOne({
      email: 'user@billing.test',
    })).ops[0];

    member = (await users.insertOne({
      email: 'member@billing.test',
    })).ops[0];

    admin = (await users.insertOne({
      email: 'admin@billing.test',
    })).ops[0];

    planToChange = (await plans.insertOne({
      name: 'BasicTest',
      monthlyCharge: 20,
      monthlyChargeCurrency: 'USD',
      eventsLimit: 10000,
      isDefault: false,
    })).ops[0];

    const team = await accountsDb.collection<ConfirmedMemberDBScheme>(`team:${workspace._id.toString()}`);

    await team.insertOne({
      userId: member._id,
    });

    await team.insertOne({
      userId: admin._id,
      isAdmin: true,
    });
  });

  afterEach(async () => {
    await accountsDb.dropDatabase();
  });

  describe('With SubscriptionId field only', () => {
    test('Should create business operation for workspace with that SubscriptionId', async () => {
      const request = getRequestWithSubscription(admin._id.toString());

      await workspacesCollection.updateOne(
        { _id: workspace._id },
        { $set: { subscriptionId: request.SubscriptionId } }
      );

      const apiResponse = await apiInstance.post('/billing/check', request);
      const createdBusinessOperation = await businessOperationsCollection.findOne({
        transactionId: transactionId.toString(),
      });

      expect(apiResponse.data.code).toBe(CheckCodes.SUCCESS);
      expect(createdBusinessOperation?.status).toBe(BusinessOperationStatus.Pending);
    });

    test('Should prohibit payment if no workspace with provided SubscriptionId was found', async () => {
      const request = getRequestWithSubscription(admin._id.toString());

      const apiResponse = await apiInstance.post('/billing/check', request);
      const createdBusinessOperation = await businessOperationsCollection.findOne({
        transactionId: transactionId.toString(),
      });

      expect(apiResponse.data.code).toBe(CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED);
      expect(createdBusinessOperation).toBe(null);
    });
  });

  describe('With SubscriptionId field and Data field', () => {
    test.todo('Should prohibit payment if the workspace already has a subscription');
  });

  describe('With Data field', () => {
    test('Should not accept request without necessary data', async () => {
      /**
       * Request without Data field
       */
      const data: CheckRequest = {
        ...mainRequest,
      };

      const apiResponse = await apiInstance.post('/billing/check', data);

      expect(apiResponse.data.code).toBe(CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED);
    });

    test('Should not accept request with a non-existent workspace id', async () => {
      /**
       * Request with a non-existent workspace id
       */
      const data: CheckRequest = {
        ...mainRequest,
        Data: JSON.stringify({
          checksum: await checksumService.generateChecksum({
            workspaceId: '5fe383b0126d28907780641b',
            userId: admin._id.toString(),
            tariffPlanId: planToChange._id.toString(),
            shouldSaveCard: false,
          }),
        }),
      };

      const apiResponse = await apiInstance.post('/billing/check', data);

      expect(apiResponse.data.code).toBe(CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED);
    });

    test('Should not accept request if user is not a member of the workspace', async () => {
      /**
       * Request with a user who is not a member of the workspace
       */
      const data: CheckRequest = {
        ...mainRequest,
        Data: JSON.stringify({
          checksum: await checksumService.generateChecksum({
            workspaceId: workspace._id.toString(),
            userId: externalUser._id.toString(),
            tariffPlanId: planToChange._id.toString(),
            shouldSaveCard: false,
          }),
        }),
      };

      const apiResponse = await apiInstance.post('/billing/check', data);

      expect(apiResponse.data.code).toBe(CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED);
    });

    test('Should not accept request if user is not an admin', async () => {
      /**
       * Request with a user who is not an admin of the workspace
       */
      const data: CheckRequest = {
        ...mainRequest,
        Data: JSON.stringify({
          checksum: await checksumService.generateChecksum({
            workspaceId: workspace._id.toString(),
            userId: member._id.toString(),
            tariffPlanId: planToChange._id.toString(),
            shouldSaveCard: false,
          }),
        }),
      };

      const apiResponse = await apiInstance.post('/billing/check', data);

      expect(apiResponse.data.code).toBe(CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED);
    });

    test('Should not accept request with non-existent plan', async () => {
      /**
       * Request with a non-existent plan id
       */
      const data: CheckRequest = {
        ...mainRequest,
        Data: JSON.stringify({
          checksum: await checksumService.generateChecksum({
            workspaceId: workspace._id.toString(),
            userId: admin._id.toString(),
            tariffPlanId: '5fe383b0126d28007780641b',
            shouldSaveCard: false,
          }),
        }),
      };

      const apiResponse = await apiInstance.post('/billing/check', data);

      expect(apiResponse.data.code).toBe(CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED);
    });

    test('Should not accept request because amount in request doesn\'t match with plan monthly charge', async () => {
      /**
       * Request with amount that does not match the cost of the plan
       */
      const data: CheckRequest = {
        ...mainRequest,
        Amount: '20.45',
        Data: JSON.stringify({
          checksum: await checksumService.generateChecksum({
            workspaceId: workspace._id.toString(),
            userId: admin._id.toString(),
            tariffPlanId: planToChange._id.toString(),
            shouldSaveCard: false,
          }),
        }),
      };

      const apiResponse = await apiInstance.post('/billing/check', data);

      expect(apiResponse.data.code).toBe(CheckCodes.WRONG_AMOUNT);
    });

    test('Should create business operation with pending status', async () => {
      /**
       * Correct data
       */
      const data: CheckRequest = {
        ...mainRequest,
        Data: JSON.stringify({
          checksum: await checksumService.generateChecksum({
            workspaceId: workspace._id.toString(),
            userId: admin._id.toString(),
            tariffPlanId: planToChange._id.toString(),
            shouldSaveCard: false,
          }),
        }),
      };

      const apiResponse = await apiInstance.post('/billing/check', data);
      const createdBusinessOperation = await businessOperationsCollection.findOne({
        transactionId: transactionId.toString(),
      });

      expect(apiResponse.data.code).toBe(CheckCodes.SUCCESS);
      expect(createdBusinessOperation?.status).toBe(BusinessOperationStatus.Pending);
    });
  });

  test('Should allow request with amount = 1$, in case of deferred payment', async () => {
    /**
     * Correct data
     */
    const data: CheckRequest = {
      ...mainRequest,
      Data: JSON.stringify({
        checksum: await checksumService.generateChecksum({
          workspaceId: workspace._id.toString(),
          userId: admin._id.toString(),
          tariffPlanId: planToChange._id.toString(),
          shouldSaveCard: false,
        }),
        cloudPayments: {
          recurrent: {
            interval: 'Month',
            period: 1,
            startDate: new Date().toString(),
            amount: 1,
          },
        },
      }),
    };

    const apiResponse = await apiInstance.post('/billing/check', data);
    const createdBusinessOperation = await businessOperationsCollection.findOne({
      transactionId: transactionId.toString(),
    });

    expect(apiResponse.data.code).toBe(CheckCodes.SUCCESS);
    expect(createdBusinessOperation?.status).toBe(BusinessOperationStatus.Pending);
  });
});
