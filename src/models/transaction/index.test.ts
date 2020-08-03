import TransactionModel, { TransactionStatus } from './transaction';
import { ObjectId } from 'mongodb';

describe('Transaction model', () => {
  test('should create instance', () => {
    const data = {
      workspaceId: new ObjectId('5edd36fbb596d4759beb89f6'),
      amount: 100,
      dtCreated: Date.now(),
      status: TransactionStatus.PENDING,
      userId: new ObjectId('5eb9034a1ccc4421e2623dc2'),
      cardPan: '4455',
    };

    const transaction = new TransactionModel(data);

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
