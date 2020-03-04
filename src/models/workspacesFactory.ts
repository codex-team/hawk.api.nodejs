import AbstractModelFactory from './abstactModelFactory';
import { Collection, Db } from 'mongodb';
import WorkspaceModel, { WorkspaceDBScheme } from './workspace';
import DataLoaders from '../dataLoaders';

/**
 * Users factory to work with User Model
 */
export default class WorkspacesFactory extends AbstractModelFactory<WorkspaceDBScheme, WorkspaceModel> {
  /**
   * DataBase collection to work with
   */
  protected collection: Collection<WorkspaceDBScheme>;

  /**
   * DataLoaders for fetching data from database
   */
  private dataLoaders: DataLoaders;

  /**
   * Creates user factory instance
   * @param dbConnection - connection to DataBase
   * @param dataLoaders - dataLoaders for fetching data
   */
  constructor(dbConnection: Db, dataLoaders: DataLoaders) {
    super(dbConnection, WorkspaceModel);
    this.collection = dbConnection.collection('workspaces');
    this.dataLoaders = dataLoaders;
  }

  /**
   * Creates new workspace in DB
   * @param workspaceData - workspace's data
   */
  public async create(workspaceData: WorkspaceDBScheme): Promise<WorkspaceModel> {
    const workspaceId = (await this.collection.insertOne(workspaceData)).insertedId;

    return new WorkspaceModel({
      _id: workspaceId,
      ...workspaceData,
    });
  }

  /**
   * Get Workspaces list by their ids
   * @param ids - workspaces ids to fetch
   */
  public async findManyByIds(ids: string[]): Promise<WorkspaceModel[]> {
    return (await this.dataLoaders.workspaceById.loadMany(ids))
      .map((data) => data instanceof Error ? null : new WorkspaceModel(data))
      .filter(Boolean) as WorkspaceModel[];
  }
}
