import AbstractModelFactory from '../abstactModelFactory';
import TransactionModel, { TransactionDBScheme } from './transaction';
import { Collection, Db } from 'mongodb';
import DataLoaders from '../../dataLoaders';

/**
 * Transactions factory to work with Transaction model
 */
export default class TransactionsFactory extends AbstractModelFactory<TransactionDBScheme, TransactionModel> {
  /**
   * DataBase collection to work with
   *
   * @protected
   */
  protected collection: Collection<TransactionDBScheme>;

  /**
   * Creates transactions factory instance
   *
   * @param dbConnection - connection to DataBase
   * @param dataLoaders - dataLoaders for fetching data
   */
  constructor(dbConnection: Db, dataLoaders: DataLoaders) {
    super(dbConnection, TransactionModel);
    this.collection = dbConnection.collection('transactions');
  }

  /**
   * Creates new transaction in DataBase
   *
   * @param transactionData - transaction data for creating
   */
  public async create(transactionData: TransactionDBScheme): Promise<TransactionModel> {
    const transactionId = (await this.collection.insertOne(transactionData)).insertedId;

    const transaction = new TransactionModel({
      _id: transactionId,
      ...transactionData,
    });

    return transaction;
  }
}
