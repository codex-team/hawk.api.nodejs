import { apiInstance } from '../../utils';
import { PayCodes, PayRequest } from '../../../../src/billing/types';
import { CardType, Currency, OperationStatus, OperationType } from '../../../../src/billing/types/enums';
import { Collection, ObjectId } from 'mongodb';
import { BusinessOperationDBScheme, BusinessOperationStatus, BusinessOperationType, WorkspaceDBScheme, PlanDBScheme } from 'hawk.types';

const transactionId = 123456;

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

/**
 * Valid data to send to `pay` webhook
 */
const validPayRequestData: PayRequest = {
  Amount: 10,
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
  Data: {
    workspaceId: workspace._id.toString(),
    tariffPlanId: tariffPlan._id.toString(),
  },
};

describe('Pay webhook', () => {
  let businessOperationsCollection: Collection<BusinessOperationDBScheme>;
  let workspacesCollection: Collection<WorkspaceDBScheme>;
  let tariffPlanCollection: Collection<PlanDBScheme>;

  beforeAll(async () => {
    const accountsDb = await global.mongoClient.db('hawk');

    businessOperationsCollection = accountsDb.collection('businessOperations');
    workspacesCollection = accountsDb.collection('workspaces');
    tariffPlanCollection = accountsDb.collection('plans');

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
        userId: new ObjectId(),
        cardPan: '2456',
      },
    });

    /**
     * Add workspace for testing it
     */
    await workspacesCollection.insertOne(workspace);

    /**
     * Add tariff plan for testing
     */
    await tariffPlanCollection.insertOne(tariffPlan);
  });

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
    expect(updatedWorkspace?.tariffPlanId.toString()).toBe(validPayRequestData.Data?.tariffPlanId?.toString());
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

  test.todo('Should add payment data to accounting system');
});
