import DataLoader from 'dataloader';
import { Db, ObjectId } from 'mongodb';
import { WorkspaceDBScheme } from './models/workspace';
import { UserDBScheme } from './models/user';

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
   * Loader for fetching projects by their ids
   */
  public projectById = new DataLoader<string, ProjectDBScheme>(
    (projectIds) => this.batchByIds<ProjectDBScheme>('projects', projectIds),
    { cache: false }
  );

  /**
   * Loader for fetching workspaces
   */
  public workspaceById = new DataLoader<string, WorkspaceDBScheme>(
    (workspaceIds) => this.batchByIds<WorkspaceDBScheme>('workspaces', workspaceIds),
    { cache: false }
  );

  /**
   * Loader for fetching users by their ids
   */
  public userById = new DataLoader<string, UserDBScheme>(
    (userIds) => this.batchByIds<UserDBScheme>('users', userIds),
    { cache: false }
  );

  /**
   * Loader for fetching users by their emails
   */
  public userByEmail = new DataLoader<string, UserDBScheme>(
    (userEmails) =>
      this.batchByField<UserDBScheme, string>('users', userEmails, 'email'),
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
    return this.batchByField<T, ObjectId>(collectionName, ids.map(id => new ObjectId(id)), '_id');
  }

  /**
   * Batching function for resolving entities by certain field
   * @param collectionName - collection name to get entities
   * @param values - values for resolving
   * @param fieldName - field name to resolve
   */
  private async batchByField<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    T extends {[key: string]: any},
    FieldType extends object | string
    >(collectionName: string, values: ReadonlyArray<FieldType>, fieldName: string): Promise<(T | Error)[]> {
    const queryResult = await this.dbConnection.collection(collectionName)
      .find({
        [fieldName]: { $in: values },
      })
      .toArray();

    /**
     * Map for making associations between given id and fetched entity
     * It's because MongoDB `find` mixed all entities
     */
    const entitiesMap: Record<string, T> = {};

    queryResult.forEach((entity: T) => {
      entitiesMap[entity[fieldName].toString()] = entity;
    }, {});

    return values.map((field) => entitiesMap[field.toString()] || new Error('No entity with such ' + fieldName));
  }
}