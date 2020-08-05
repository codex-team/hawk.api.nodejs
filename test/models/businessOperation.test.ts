import BusinessOperationModel, {
  BusinessOperationStatus,
  BusinessOperationType, PayloadOfDepositByUser, PayloadOfWorkspacePlanPurchase
} from '../../src/models/businessOperation';
import { ObjectId } from 'mongodb';
import * as mongo from '../../src/mongo';

beforeAll(async () => {
  await mongo.setupConnections();
});

describe('Transaction model', () => {
  it('should create instance for top-up balance by user', () => {
    const payloadTopUpByUser = {
      workspaceId: new ObjectId('5edd36fbb596d4759beb89f6'),
      amount: 100,
      userId: new ObjectId('5eb9034a1ccc4421e2623dc2'),
      cardPan: '4455',
    };

    const data = {
      transactionId: 'Transaction ID',
      type: BusinessOperationType.DEPOSIT_BY_USER,
      status: BusinessOperationStatus.CONFIRMED,
      payload: payloadTopUpByUser,
    };

    const businessOperation = new BusinessOperationModel<PayloadOfDepositByUser>(data);

    expect(businessOperation).toMatchObject(data);
  });

  it('should create instance for write-off by payment worker', () => {
    const payloadWriteOff = {
      workspaceId: new ObjectId('5edd36fbb596d4759beb89f6'),
      amount: 100,
    };

    const data = {
      transactionId: 'Transaction ID',
      type: BusinessOperationType.WORKSPACE_PLAN_PURCHASE,
      status: BusinessOperationStatus.CONFIRMED,
      payload: payloadWriteOff,
    };

    const businessOperation = new BusinessOperationModel<PayloadOfWorkspacePlanPurchase>(data);

    expect(businessOperation).toMatchObject(data);
  });
});

afterAll(async done => {
  await mongo.mongoClients.hawk?.close();
  await mongo.mongoClients.events?.close();

  done();
});
