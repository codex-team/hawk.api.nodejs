import { Collection, Db } from 'mongodb';
import { databases } from '../mongo';

/**
 * Model constructor type
 */
export type ModelConstructor<DBScheme, Model extends BaseModel<DBScheme>> = new (modelData: DBScheme) => Model;

/**
 * Base model
 */
export default abstract class BaseModel<DBScheme> {
  /**
   * Database connection to interact with DB
   */
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  protected readonly dbConnection: Db = databases.hawk!;

  /**
   * Creates model instance
   * @param modelData - data to fill model
   */
  protected constructor(modelData: DBScheme) {
    Object.assign(this, modelData);
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
