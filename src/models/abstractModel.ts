import { Collection, Db } from 'mongodb';

/**
 * Model constructor type
 */
export type ModelConstructor<DBScheme, Model extends BaseModel<DBScheme>> = new (dbConnection: Db, modelData: DBScheme) => Model;

/**
 * Base model
 */
export default abstract class BaseModel<DBScheme> {
  /**
   * Database connection to interact with DB
   */
  private dbConnection: Db;

  /**
   * Creates model instance
   * @param dbConnection - database connection to interact with DB
   * @param modelData - data to fill model
   */
  protected constructor(dbConnection: Db, modelData: DBScheme) {
    Object.assign(this, modelData);
    this.dbConnection = dbConnection;
  };

  /**
   * Model's collection
   */
  protected static get collection(): Collection {
    throw new Error('Collection getter is not implemented');
  }

  /**
   * Update entity data
   * @param query - query to match
   * @param data - update data
   * @return number of documents modified
   */
  public static async update(query: object, data: object): Promise<number> {
    return (await this.collection.updateOne(query, { $set: data })).modifiedCount;
  }
}
