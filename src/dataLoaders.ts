import DataLoader from 'dataloader';
import { Db, ObjectId } from 'mongodb';
import { PlanDBScheme, UserDBScheme, WorkspaceDBScheme, ProjectDBScheme, EventData, EventAddons } from '@hawk.so/types';

type EventDbScheme = {
  _id: ObjectId;
} & EventData<EventAddons>;

/**
 * Class for setting up data loaders
 */
export default class DataLoaders {
  /**
   * Loader for fetching projects by their ids
   */
  public projectById = new DataLoader<string, ProjectDBScheme | null>(
    (projectIds) => this.batchByIds<ProjectDBScheme>('projects', projectIds),
    { cache: false }
  );

  /**
   * Loader for fetching workspaces
   */
  public workspaceById = new DataLoader<string, WorkspaceDBScheme | null>(
    (workspaceIds) => this.batchByIds<WorkspaceDBScheme>('workspaces', workspaceIds),
    { cache: false }
  );

  /**
   * Loader for fetching plans
   */
  public planById = new DataLoader<string, PlanDBScheme | null>(
    (planIds) => this.batchByIds<PlanDBScheme>('plans', planIds),
    { cache: true }
  );

  /**
   * Loader for fetching users by their ids
   */
  public userById = new DataLoader<string, UserDBScheme | null>(
    (userIds) => this.batchByIds<UserDBScheme>('users', userIds),
    { cache: false }
  );

  /**
   * Loader for fetching users by their emails
   */
  public userByEmail = new DataLoader<string, UserDBScheme | null>(
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
  private async batchByIds<T extends { _id: ObjectId }>(collectionName: string, ids: ReadonlyArray<string>): Promise<(T | null | Error)[]> {
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
    T extends { [key: string]: any },
    FieldType extends object | string
  >(collectionName: string, values: ReadonlyArray<FieldType>, fieldName: string): Promise<(T | null | Error)[]> {
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

    return values.map((field) => entitiesMap[field.toString()] || null);
  }
}

/**
 * Create DataLoader for events in dynamic collections `events:<projectId>` stored in the events DB
 * @param eventsDb - MongoDB connection to the events database
 * @param projectId - project id used to pick a dynamic collection
 */
export function createProjectEventsByIdLoader(
  eventsDb: Db,
  projectId: string
): DataLoader<string, EventDbScheme | null> {
  return new DataLoader<string, EventDbScheme | null>(async (ids) => {
    const objectIds = ids.map((id) => new ObjectId(id));

    const docs = await eventsDb
      .collection(`events:${projectId}`)
      .find({ _id: { $in: objectIds } })
      .toArray();

    const map: Record<string, EventDbScheme> = {};

    docs.forEach((doc) => {
      map[doc._id.toString()] = doc as EventDbScheme;
    });

    return ids.map((id) => map[id] || null);
  }, { cache: true });
}
