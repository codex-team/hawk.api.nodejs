import DataLoader from 'dataloader';
import { Db, ObjectId } from 'mongodb';

/**
 * Project representation in DataBase
 * @todo move to the project model when it will be rewrite to ts
 */
interface ProjectDBScheme {
  /**
   * Project id
   */
  _id: ObjectId;

  /**
   * Name of the project
   */
  name: string;

  /**
   * Project description
   */
  description?: string;

  /**
   * Project image
   */
  image?: string;

  /**
   * User who added the project
   */
  uidAdded: ObjectId;

  /**
   * Workspace id who owns the project
   */
  workspaceId: ObjectId;

  /**
   * Project token for errors collecting
   */
  token: string;
}

/**
 * Class for setting up data loaders
 */
export default class DataLoaders {
  /**
   * Loader for fetching persons by their ids
   */
  public projectById = new DataLoader<string, ProjectDBScheme>(
    (projectIds) => this.batchByIds<ProjectDBScheme>('projects', projectIds),
    { cache: false }
  );

  /**
   * MongoDB connection to make queries
   */
  private dbConnection: Db;

  /**
   * Creates DataLoaders instance
   * @param dbConnection - MongoDB connection to make queries
   */
  constructor(dbConnection: Db) {
    this.dbConnection = dbConnection;
  }

  /**
   * Batching function for resolving entities from their ids
   * @param collectionName - collection name to get entities
   * @param ids - ids for resolving
   */
  private async batchByIds<T extends {_id: ObjectId}>(collectionName: string, ids: ReadonlyArray<string>): Promise<(T | Error)[]> {
    const queryResult = await this.dbConnection.collection(collectionName)
      .find({
        _id: { $in: ids.map(id => new ObjectId(id)) },
      })
      .toArray();

    /**
     * Map for making associations between given id and fetched entity
     * It's because MongoDB `find` mixed all entities
     */
    const entitiesMap: Record<string, T> = {};

    queryResult.forEach((entity: T) => {
      entitiesMap[entity._id.toString()] = entity;
    }, {});

    return ids.map((entityId) => entitiesMap[entityId] as T || new Error('No entity with such id'));
  }
}
