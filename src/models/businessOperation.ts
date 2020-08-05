import AbstractModel from './abstractModel';
import { Collection, ObjectId } from 'mongodb';

/**
 * Business operations statuses
 */
export enum BusinessOperationStatus {
  /**
   * Business operation is pending
   */
  PENDING='PENDING',

  /**
   * Business operation is confirmed
   */
  CONFIRMED='CONFIRMED',

  /**
   * Business operation is rejected
   */
  REJECTED='REJECTED'
}

/**
 * Types of business operations
 */
export enum BusinessOperationType {
  /**
   * Write-off money from workspace by payment worker
   */
  PAYMENT_WORKER_WRITE_OFF='PAYMENT_WORKER_WRITE_OFF',

  /**
   * Workspace top up balance by user
   */
  TOP_UP_BALANCE_BY_USER='TOP_UP_BALANCE_BY_USER'
}

/**
 * Business operation payload type for `TOP_UP_BALANCE_BY_USER` operation type
 */
export interface PayloadOfTopUpBalanceByUser {
  /**
   * Workspace ID to which the payment is credited
   */
  workspaceId: ObjectId;

  /**
   * Amount of payment
   */
  amount: number;

  /**
   * Business operation status
   */
  status: BusinessOperationStatus;

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
 * Business operation payload type for `PAYMENT_WORKER_WRITE_OFF` operation type
 */
export interface PayloadOfPaymentWorkerWriteOff {
  /**
   * Workspace ID to which the payment is debited
   */
  workspaceId: ObjectId;

  /**
   * Amount of payment
   */
  amount: number;

  /**
   * Business operation status
   */
  status: BusinessOperationStatus;
}

type BusinessOperationPayloadType = PayloadOfTopUpBalanceByUser | PayloadOfPaymentWorkerWriteOff;

/**
 * Structure represents a Business operation in DataBase
 */
export interface BusinessOperationDBScheme {
  /**
   * Business operation ID
   */
  _id?: ObjectId;

  /**
   * Business operation Transaction ID
   */
  transactionId: string;

  /**
   * Business operation type
   */
  businessOperationType: BusinessOperationType;

  /**
   * Business operation payload
   */
  payload: BusinessOperationPayloadType;
}

/**
 * Model representing business operation object
 */
export default class BusinessOperationModel extends AbstractModel<BusinessOperationDBScheme> implements BusinessOperationDBScheme {
  /**
   * Business operation ID
   */
  public _id?: ObjectId;

  /**
   * Business operation Transaction ID
   */
  public transactionId!: string;

  /**
   * Business operation type
   */
  public businessOperationType!: BusinessOperationType;

  /**
   * Business operation payload
   */
  public payload!: BusinessOperationPayloadType;

  /**
   * Model's collection
   *
   * @protected
   */
  protected collection: Collection<BusinessOperationDBScheme>;

  /**
   * Create Business operation instance
   *
   * @param businessOperationData - business operation data
   */
  constructor(businessOperationData: BusinessOperationDBScheme) {
    super(businessOperationData);
    this.collection = this.dbConnection.collection<BusinessOperationDBScheme>('businessOperations');
  }
}
