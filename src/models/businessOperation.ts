import AbstractModel from './abstractModel';
import { Collection, ObjectId } from 'mongodb';
import {
  BusinessOperationDBScheme,
  BusinessOperationPayloadType,
  BusinessOperationStatus,
  BusinessOperationType
} from '@hawk.so/types';

/**
 * Model representing business operation object
 */
export default class BusinessOperationModel<T extends BusinessOperationPayloadType = BusinessOperationPayloadType> extends AbstractModel<BusinessOperationDBScheme<T>> implements BusinessOperationDBScheme<T> {
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
   * Date when operation was created
   */
  public dtCreated!: Date;

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

  /**
   * Changes status of business operation
   * @param status - new status
   */
  public async setStatus(status: BusinessOperationStatus): Promise<void> {
    if (this._id) {
      await this.collection.updateOne({ _id: this._id }, {
        $set: {
          status: status,
        },
      });
    }
    this.status = status;
  }
}
