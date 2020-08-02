import AbstractModel from '../abstractModel';
import { Collection, ObjectId } from 'mongodb';

/**
 * Transaction statuses
 */
export enum TransactionStatus {
  /**
   * Transaction is pending
   */
  PENDING='PENDING',

  /**
   * Transaction is confirmed
   */
  CONFIRMED='CONFIRMED',

  /**
   * Transaction is rejected
   */
  REJECTED='REJECTED'
}

/**
 * Structure represents a Transaction in DataBase
 */
export interface TransactionDBScheme {
  /**
   * Transaction ID
   */
  _id?: ObjectId;

  /**
   * Workspace ID to which the payment is credited
   */
  workspaceId: ObjectId;

  /**
   * Amount of payment
   */
  amount: number;

  /**
   * Transaction creation datetime
   */
  dtCreated: number;

  /**
   * Transaction status
   */
  status: TransactionStatus;

  /**
   * ID of the user who made the payment
   */
  userId: ObjectId;

  /**
   * PAN of card which user made the payment
   */
  cardPan: string;
}

/**
 * Model representing transaction object
 */
export default class TransactionModel extends AbstractModel<TransactionDBScheme> implements TransactionDBScheme {
  /**
   * Transaction ID
   */
  public _id!: ObjectId;

  /**
   * Workspace ID to which the payment is credited
   */
  public workspaceId!: ObjectId;

  /**
   * Amount of payment
   */
  public amount!: number;

  /**
   * Transaction creation datetime
   */
  public dtCreated!: number;

  /**
   * Transaction status
   */
  public status!: TransactionStatus;

  /**
   * ID of the user who made the payment
   */
  public userId!: ObjectId;

  /**
   * PAN of card which user made the payment
   */
  public cardPan!: string;

  /**
   * Model's collection
   *
   * @protected
   */
  protected collection: Collection<TransactionDBScheme>;

  /**
   * Create Transaction instance
   *
   * @param transactionData - transaction data
   */
  constructor(transactionData: TransactionDBScheme) {
    super(transactionData);
    this.collection = this.dbConnection.collection<TransactionDBScheme>('transactions');
  }
}
