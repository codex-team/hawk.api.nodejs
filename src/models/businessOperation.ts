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
  WORKSPACE_PLAN_PURCHASE='WORKSPACE_PLAN_PURCHASE',

  /**
   * Workspace top-up balance by user
   */
  DEPOSIT_BY_USER='DEPOSIT_BY_USER'
}

/**
 * Business operation payload type for `DEPOSIT_BY_USER` operation type
 */
export interface PayloadOfDepositByUser {
  /**
   * Workspace ID to which the payment is credited
   */
  workspaceId: ObjectId;

  /**
   * Amount of payment
   */
  amount: number;

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
 * Business operation payload type for `WORKSPACE_PLAN_PURCHASE` operation type
 */
export interface PayloadOfWorkspacePlanPurchase {
  /**
   * Workspace ID to which the payment is debited
   */
  workspaceId: ObjectId;

  /**
   * Amount of payment
   */
  amount: number;
}

/**
 * Type of business operation payload, it depends of type field
 */
type BusinessOperationPayloadType = PayloadOfDepositByUser | PayloadOfWorkspacePlanPurchase;

/**
 * Structure represents a Business operation in DataBase
 */
export interface BusinessOperationDBScheme<T extends BusinessOperationPayloadType> {
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
  type: BusinessOperationType;

  /**
   * Business operation status
   */
  status: BusinessOperationStatus;

  /**
   * Business operation payload
   */
  payload: T;
}

/**
 * Model representing business operation object
 */
export default class BusinessOperationModel<T extends BusinessOperationPayloadType> extends AbstractModel<BusinessOperationDBScheme<T>> implements BusinessOperationDBScheme<T> {
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
  public type!: BusinessOperationType;

  /**
   * Business operation status
   */
  public status!: BusinessOperationStatus;

  /**
   * Business operation payload
   */
  public payload!: T;

  /**
   * Model's collection
   */
  protected collection: Collection<BusinessOperationDBScheme<T>>;

  /**
   * Create Business operation instance
   *
   * @param businessOperationData - business operation data
   */
  constructor(businessOperationData: BusinessOperationDBScheme<T>) {
    super(businessOperationData);
    this.collection = this.dbConnection.collection<BusinessOperationDBScheme<T>>('businessOperations');
  }
}
