import '../../src/env-test';
import * as mongo from '../../src/mongo';
import BusinessOperationsFactory from '../../src/models/businessOperationsFactory';
import DataLoaders from '../../src/dataLoaders';
import { Db, ObjectId } from 'mongodb';
import { BusinessOperationStatus, BusinessOperationType, PayloadOfDepositByUser } from '@hawk.so/types';

beforeAll(async () => {
  await mongo.setupConnections();
});

describe('Business operation factory', () => {

  it('should create factory instance', () => {
    console.log(mongo.databases.hawk)
    const factory = new BusinessOperationsFactory(mongo.databases.hawk as Db, new DataLoaders(mongo.databases.hawk as Db));

    expect(factory).not.toBe(undefined);
  });

  it('should create operation instance', async () => {
    const factory = new BusinessOperationsFactory(mongo.databases.hawk as Db, new DataLoaders(mongo.databases.hawk as Db));

    const payloadDepositByUser = {
      workspaceId: new ObjectId('5edd36fbb596d4759beb89f6'),
      amount: 100,
      userId: new ObjectId('5eb9034a1ccc4421e2623dc2'),
      cardPan: '4455',
      currency: 'RUB',
    };

    const data = {
      transactionId: 'Transaction ID',
      type: BusinessOperationType.DepositByUser,
      status: BusinessOperationStatus.Confirmed,
      dtCreated: new Date(),
      payload: payloadDepositByUser,
    };

    const businessOperation = await factory.create<PayloadOfDepositByUser>(data);

    expect(businessOperation).toMatchObject(data);
  });

});

afterAll(async done => {
  await mongo.mongoClients.hawk?.close();
  await mongo.mongoClients.events?.close();

  done();
});

