import AbstractModelFactory from './abstactModelFactory';
import BusinessOperationModel, { BusinessOperationDBScheme, BusinessOperationPayloadType } from './businessOperation';
import { Collection, Db, ObjectId } from 'mongodb';
import DataLoaders from '../dataLoaders';

/**
 * Business operations factory to work with Business operation model
 */
export default class BusinessOperationsFactory extends AbstractModelFactory<BusinessOperationDBScheme, BusinessOperationModel> {
  /**
   * DataBase collection to work with
   */
  protected collection: Collection<BusinessOperationDBScheme>;

  /**
   * Creates business operations factory instance
   *
   * @param dbConnection - connection to DataBase
   * @param dataLoaders - dataLoaders for fetching data
   */
  constructor(dbConnection: Db, dataLoaders: DataLoaders) {
    super(dbConnection, BusinessOperationModel);
    this.collection = dbConnection.collection('businessOperations');
  }

  /**
   * Creates new business operations in DataBase
   *
   * @param businessOperationData - business operation data for creating
   */
  public async create<T extends BusinessOperationPayloadType = BusinessOperationPayloadType>(businessOperationData: BusinessOperationDBScheme<T>): Promise<BusinessOperationModel<T>> {
    const businessOperationId = (await this.collection.insertOne(businessOperationData)).insertedId;

    const businessOperation = new BusinessOperationModel<T>({
      _id: businessOperationId,
      ...businessOperationData,
    });

    return businessOperation;
  }

  /**
   * Return business operations for passed workspaces
   *
   * @param {string[]} workspaceIds - ids of workspaces
   */
  public async getWorkspacesBusinessOperations(workspaceIds: string[]): Promise<BusinessOperationModel[]> {
    const workspaceObjectIds = workspaceIds.map((id: string): ObjectId => new ObjectId(id));
    const docs = await this.collection.find({
      'payload.workspaceId': { $in: workspaceObjectIds },
    }).toArray();

    return docs.map((doc: BusinessOperationDBScheme): BusinessOperationModel => new BusinessOperationModel(doc));
  }
}
