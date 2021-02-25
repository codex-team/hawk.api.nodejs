import { accountingEnv, apiInstance } from '../../utils';
import { FailCodes, FailRequest } from '../../../../src/billing/types';
import { CardType, Currency, OperationStatus, OperationType, ReasonCode } from '../../../../src/billing/types/enums';
import { Collection, ObjectId, Db } from 'mongodb';
import { BusinessOperationDBScheme, BusinessOperationStatus, BusinessOperationType, WorkspaceDBScheme, PlanDBScheme } from 'hawk.types';

const transactionId = 123456;

const mainRequest: FailRequest = {
  Amount: 200,
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
  Reason: 'Something went wrong',
  ReasonCode: ReasonCode.DO_NOT_HONOR,
};

describe('Fail webhook', () => {
  let businessOperationsCollection: Collection<BusinessOperationDBScheme>;

  beforeAll(async () => {
    const accountsDb = await global.mongoClient.db('hawk');

    businessOperationsCollection = await accountsDb.collection<BusinessOperationDBScheme>('businessOperations');

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
        amount: 200,
        userId: new ObjectId(),
        cardPan: '5367',
      },
    });
  });

  test('Should change business operation status to rejected', async () => {
    const apiResponse = await apiInstance.post('/billing/fail', mainRequest);

    const updatedBusinessOperation = await businessOperationsCollection.findOne({
      transactionId: transactionId.toString(),
    });

    expect(apiResponse.data.code).toBe(FailCodes.SUCCESS);
    expect(updatedBusinessOperation?.status).toBe(BusinessOperationStatus.Rejected);
  });
});