import { apiInstance } from '../../utils';
import { PayCodes, PayRequest } from '../../../../src/billing/types';
import { CardType, Currency, OperationStatus, OperationType } from '../../../../src/billing/types/enums';
import { Collection, ObjectId } from 'mongodb';
import { BusinessOperationDBScheme, BusinessOperationStatus, BusinessOperationType } from 'hawk.types';

const transactionId = 123456;

describe('Pay webhook', () => {
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
        amount: 10,
        userId: new ObjectId(),
        cardPan: '2456',
      },
    });
  });

  test('Should change business operation status to confirmed', async () => {
    /**
     * Data to send to `pay` webhook
     */
    const data: PayRequest = {
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
    };

    const apiResponse = await apiInstance.post('/billing/pay', data);
    const updatedBusinessOperation = await businessOperationsCollection.findOne({
      transactionId: transactionId.toString(),
    });

    expect(apiResponse.data.code).toBe(PayCodes.SUCCESS);
    expect(updatedBusinessOperation?.status).toBe(BusinessOperationStatus.Confirmed);
  });
});
