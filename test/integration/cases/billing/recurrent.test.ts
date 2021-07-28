import { Collection, Db, ObjectId } from 'mongodb';
import { PlanDBScheme, WorkspaceDBScheme } from 'hawk.types';
import { RecurrentCodes, RecurrentRequest } from '../../../../src/billing/types';
import { Currency, Interval, SubscriptionStatus } from '../../../../src/billing/types/enums';
import { apiInstance } from '../../utils';

const currentPlan: PlanDBScheme = {
  _id: new ObjectId(),
  eventsLimit: 1000,
  isDefault: true,
  monthlyCharge: 1000,
  name: 'Test plan',
};

const workspace: WorkspaceDBScheme = {
  _id: new ObjectId(),
  accountId: '123',
  balance: 0,
  billingPeriodEventsCount: 1000,
  lastChargeDate: new Date(2020, 10, 4),
  name: 'Test workspace',
  tariffPlanId: currentPlan._id,
  inviteHash: '12345678',
  subscriptionId: '123123',
};

const request: RecurrentRequest = {
  AccountId: '123',
  Amount: '123',
  Currency: Currency.USD,
  Description: 'Description',
  Email: 'test@hawk.so',
  FailedTransactionsNumber: 0,
  Id: '123123',
  Interval: Interval.MONTH,
  Period: 0,
  RequireConfirmation: false,
  StartDate: '',
  Status: SubscriptionStatus.CANCELLED,
  SuccessfulTransactionsNumber: 0,
};

describe('Recurrent webhook', () => {
  let accountsDb: Db;
  let workspacesCollection: Collection<WorkspaceDBScheme>;

  beforeAll(async () => {
    accountsDb = await global.mongoClient.db('hawk');

    workspacesCollection = accountsDb.collection('workspaces');
  });

  beforeEach(async () => {
    /**
     * Add workspace for testing it
     */
    await workspacesCollection.insertOne(workspace);
  });

  afterEach(async () => {
    await accountsDb.dropDatabase();
  });

  describe('Cancelled status', () => {
    test('Should remove subscriptionId field from workspace', async () => {
      const apiResponse = await apiInstance.post('/billing/recurrent', request);

      const updatedWorkspace = await workspacesCollection.findOne({ _id: workspace._id });

      expect(apiResponse.data.code).toBe(RecurrentCodes.SUCCESS);
      expect(updatedWorkspace?.subscriptionId).toBeFalsy();
    });
    test.todo('Should notify user about subscription cancelling');
  });

  describe('Rejected status', () => {
    test('Should remove subscriptionId field from workspace', async () => {
      const apiResponse = await apiInstance.post('/billing/recurrent', {
        ...request,
        Status: SubscriptionStatus.REJECTED,
      });

      const updatedWorkspace = await workspacesCollection.findOne({ _id: workspace._id });

      expect(apiResponse.data.code).toBe(RecurrentCodes.SUCCESS);
      expect(updatedWorkspace?.subscriptionId).toBeFalsy();
    });
    test.todo('Should notify user about subscription cancelling');
  });
});
