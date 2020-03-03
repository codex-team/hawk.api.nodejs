import AbstractModelFactory from './abstactModelFactory';
import { Collection, Db } from 'mongodb';
import WorkspaceModel, { WorkspaceDBScheme } from './workspace';

/**
 * Users factory to work with User Model
 */
export default class WorkspacesFactory extends AbstractModelFactory<WorkspaceDBScheme, WorkspaceModel> {
  /**
   * DataBase collection to work with
   */
  protected collection: Collection<WorkspaceDBScheme>;

  /**
   * Creates user factory instance
   * @param dbConnection - connection to DataBase
   */
  constructor(dbConnection: Db) {
    super(dbConnection, WorkspaceModel);
    this.collection = dbConnection.collection('workspaces');
  }

  /**
   * Creates new workspace in DB
   * @param workspaceData - workspace's data
   * @returns {Promise<Workspace>} - created workspace
   */
  public async create(workspaceData: WorkspaceDBScheme): Promise<WorkspaceModel> {
    const workspaceId = (await this.collection.insertOne(workspaceData)).insertedId;

    return new WorkspaceModel({
      _id: workspaceId,
      ...workspaceData,
    });
  }
}
