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

    /**
     * Undefined because it was not created in the database
     */
    expect(businessOperation._id).toBe(undefined);
    expect(businessOperation.transactionId).toEqual(data.transactionId);
    expect(businessOperation.status).toEqual(data.status);
    expect(businessOperation.type).toEqual(data.type);
    expect(businessOperation.payload.workspaceId).toEqual(payloadTopUpByUser.workspaceId);
    expect(businessOperation.payload.amount).toEqual(payloadTopUpByUser.amount);
    expect(businessOperation.payload.userId).toEqual(payloadTopUpByUser.userId);
    expect(businessOperation.payload.cardPan).toEqual(payloadTopUpByUser.cardPan);
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

    /**
     * Undefined because it was not created in the database
     */
    expect(businessOperation._id).toBe(undefined);
    expect(businessOperation.transactionId).toEqual(data.transactionId);
    expect(businessOperation.status).toEqual(data.status);
    expect(businessOperation.type).toEqual(data.type);
    expect(businessOperation.payload.workspaceId).toEqual(payloadWriteOff.workspaceId);
    expect(businessOperation.payload.amount).toEqual(payloadWriteOff.amount);
  });
});

afterAll(async done => {
  await mongo.mongoClients.hawk?.close();
  await mongo.mongoClients.events?.close();

  done();
});
