import '../../src/env-test';
import BusinessOperationModel from '../../src/models/businessOperation';
import { ObjectId } from 'mongodb';
import * as mongo from '../../src/mongo';
import {
  BusinessOperationDBScheme,
  BusinessOperationStatus,
  BusinessOperationType,
  PayloadOfDepositByUser,
  PayloadOfWorkspacePlanPurchase
} from '@hawk.so/types';

beforeAll(async () => {
  await mongo.setupConnections();
});

describe('Business operation model', () => {
  it('should create instance for deposit balance by user', () => {
    const payloadDepositByUser = {
      workspaceId: new ObjectId('5edd36fbb596d4759beb89f6'),
      amount: 100,
      currency: 'USD',
      userId: new ObjectId('5eb9034a1ccc4421e2623dc2'),
      cardPan: '4455',
    };

    const data = {
      transactionId: 'Transaction ID',
      type: BusinessOperationType.DepositByUser,
      status: BusinessOperationStatus.Confirmed,
      dtCreated: new Date(),
      payload: payloadDepositByUser,
    };

    const businessOperation = new BusinessOperationModel<PayloadOfDepositByUser>(data);

    expect(businessOperation).toMatchObject(data);
  });

  it('should create instance for workspace plan purchase by payment worker', () => {
    const payloadWorkspacePlanPurchase: PayloadOfWorkspacePlanPurchase = {
      workspaceId: new ObjectId('5edd36fbb596d4759beb89f6'),
      amount: 100,
      userId: new ObjectId(),
      tariffPlanId: new ObjectId(),
      currency: 'RUB',
    };

    const data: BusinessOperationDBScheme<PayloadOfWorkspacePlanPurchase> = {
      transactionId: 'Transaction ID',
      type: BusinessOperationType.WorkspacePlanPurchase,
      status: BusinessOperationStatus.Confirmed,
      dtCreated: new Date(),
      payload: payloadWorkspacePlanPurchase,
    };

    const businessOperation = new BusinessOperationModel<PayloadOfWorkspacePlanPurchase>(data);

    expect(businessOperation).toMatchObject(data);
  });
});

afterAll(async () => {
  await mongo.mongoClients.hawk?.close();
  await mongo.mongoClients.events?.close();
});
