import BusinessOperationModel, { BusinessOperationStatus } from '../../src/models/businessOperation';
import { ObjectId } from 'mongodb';
import * as mongo from '../../src/mongo';

beforeAll(async () => {
  await mongo.setupConnections();
});

describe('Transaction model', () => {
  it('should create instance', () => {
    const data = {
      workspaceId: new ObjectId('5edd36fbb596d4759beb89f6'),
      amount: 100,
      dtCreated: Date.now(),
      status: BusinessOperationStatus.CONFIRMED,
      userId: new ObjectId('5eb9034a1ccc4421e2623dc2'),
      cardPan: '4455',
    };

    const transaction = new BusinessOperationModel(data);

    /**
     * Undefined because it was not created in the database
     */
    expect(transaction._id).toBe(undefined);
    expect(transaction.workspaceId).toEqual(data.workspaceId);
    expect(transaction.amount).toEqual(data.amount);
    expect(transaction.dtCreated).toEqual(data.dtCreated);
    expect(transaction.status).toEqual(data.status);
    expect(transaction.userId).toEqual(data.userId);
    expect(transaction.cardPan).toEqual(data.cardPan);
  });
});

afterAll(async done => {
  await mongo.mongoClients.hawk?.close();
  await mongo.mongoClients.events?.close();

  done();
});
