import { apiInstance } from '../../utils';
import { CheckCodes, CheckRequest } from '../../../../src/billing/types';
import { CardType, Currency, OperationStatus, OperationType } from '../../../../src/billing/types/enums';
import mongodb, { Collection, ObjectId } from 'mongodb';
import { BusinessOperationDBScheme, BusinessOperationStatus, ConfirmedMemberDBScheme, PlanDBScheme, UserDBScheme, WorkspaceDBScheme } from 'hawk.types';

const transactionId = 880555;

/**
 * Basic check request
 */
const mainRequest = {
  Amount: 20,
  CardExpDate: '06/25',
  CardFirstSix: '578946',
  CardLastFour: '5367',
  CardType: CardType.VISA,
  Currency: Currency.USD,
  DateTime: new Date(),
  OperationType: OperationType.PAYMENT,
  Status: OperationStatus.COMPLETED,
  TestMode: false,
  TransactionId: transactionId,
  Issuer: 'Codex Bank',
};

describe('Check webhook', () => {
  const mongoClient = new mongodb.MongoClient('mongodb://mongodb:27017', { useUnifiedTopology: true });
  let businessOperationsCollection: Collection<BusinessOperationDBScheme>;
  let workspace: WorkspaceDBScheme;
  let user: UserDBScheme;
  let member: UserDBScheme;
  let admin: UserDBScheme;
  let plan: PlanDBScheme;

  beforeAll(async () => {
    /**
     * Initiate MongoDB connection and get necessary collections
     */
    await mongoClient.connect();

    const accountsDb = await mongoClient.db('hawk');
    const workspaces = await accountsDb.collection<WorkspaceDBScheme>('workspaces');
    const users = await accountsDb.collection<UserDBScheme>('users');
    const plans = await accountsDb.collection<PlanDBScheme>('plans');

    businessOperationsCollection = await accountsDb.collection<BusinessOperationDBScheme>('businessOperations');

    workspace = (await workspaces.insertOne({
      name: 'BillingTest',
      accountId: '123',
      tariffPlanId: new ObjectId('5fe383b0126d28007780641b'),
    } as WorkspaceDBScheme)).ops[0];

    user = (await users.insertOne({
      email: 'user@billing.test',
    })).ops[0];

    member = (await users.insertOne({
      email: 'member@billing.test',
    })).ops[0];

    admin = (await users.insertOne({
      email: 'admin@billing.test',
    })).ops[0];

    plan = (await plans.insertOne({
      name: 'BasicTest',
      monthlyCharge: 20,
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

  test('Could not accept request without necessary data', async () => {
    /**
     * Data to send to `check` webhook
     */
    const data: CheckRequest = {
      ...mainRequest,
    };

    const apiResponse = await apiInstance.post('/billing/check', data);

    expect(apiResponse.data.code).toBe(CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED);
  });

  test('Could not accept request with a non-existent workspace id', async () => {
    const data: CheckRequest = {
      ...mainRequest,
      Data: {
        workspaceId: '5fe383b0126d28907780641b',
        userId: admin._id.toString(),
        planId: plan._id.toString(),
      },
    };

    const apiResponse = await apiInstance.post('/billing/check', data);

    expect(apiResponse.data.code).toBe(CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED);
  });

  test('Could not accept request if user is not a memeber of the workspace', async () => {
    const data: CheckRequest = {
      ...mainRequest,
      Data: {
        workspaceId: workspace._id.toString(),
        userId: user._id.toString(),
        planId: plan._id.toString(),
      },
    };

    const apiResponse = await apiInstance.post('/billing/check', data);

    expect(apiResponse.data.code).toBe(CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED);
  });

  test('Could not accept request if user is not an admin', async () => {
    const data: CheckRequest = {
      ...mainRequest,
      Data: {
        workspaceId: workspace._id.toString(),
        userId: member._id.toString(),
        planId: plan._id.toString(),
      },
    };

    const apiResponse = await apiInstance.post('/billing/check', data);

    expect(apiResponse.data.code).toBe(CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED);
  });

  test('Could not accept request with non-existent plan', async () => {
    const data: CheckRequest = {
      ...mainRequest,
      Data: {
        workspaceId: workspace._id.toString(),
        userId: admin._id.toString(),
        planId: '5fe383b0126d28007780641b',
      },
    };

    const apiResponse = await apiInstance.post('/billing/check', data);

    expect(apiResponse.data.code).toBe(CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED);
  });

  test('Amount in request doesn\'t match with plan monthly charge', async () => {
    const data: CheckRequest = {
      ...mainRequest,
      Amount: 20.45,
      Data: {
        workspaceId: workspace._id.toString(),
        userId: admin._id.toString(),
        planId: plan._id.toString(),
      },
    };

    const apiResponse = await apiInstance.post('/billing/check', data);

    expect(apiResponse.data.code).toBe(CheckCodes.WRONG_AMOUNT);
  });

  test('Should create business operation with pending status', async () => {
    const data: CheckRequest = {
      ...mainRequest,
      Data: {
        workspaceId: workspace._id.toString(),
        userId: admin._id.toString(),
        planId: plan._id.toString(),
      },
    };

    const apiResponse = await apiInstance.post('/billing/check', data);
    const createdBusinessOperation = await businessOperationsCollection.findOne({
      transactionId: transactionId.toString(),
    });

    expect(apiResponse.data.code).toBe(CheckCodes.SUCCESS);
    expect(createdBusinessOperation?.status).toBe(BusinessOperationStatus.Pending);
  });

  afterAll(async () => {
    await mongoClient.close();
  });
});
