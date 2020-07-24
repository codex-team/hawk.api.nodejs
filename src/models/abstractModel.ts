import { Collection, Db } from 'mongodb';
import { databases } from '../mongo';

/**
 * Model constructor type
 */
export type ModelConstructor<DBScheme, Model extends AbstractModel<DBScheme>> = new (modelData: DBScheme) => Model;

/**
 * Base model
 */
export default abstract class AbstractModel<DBScheme> {
  /**
   * Database connection to interact with DB
   */
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  protected readonly dbConnection: Db = databases.hawk!;

  /**
   * Model's collection
   */
  protected abstract collection: Collection;

  /**
   * Creates model instance
   * @param modelData - data to fill model
   */
  protected constructor(modelData: DBScheme) {
    Object.assign(this, modelData);
  };

  /**
   * Update entity data
   * @param query - query to match
   * @param data - update data
   * @return number of documents modified
   */
  public async update(query: object, data: object): Promise<number> {
    return (await this.collection.updateOne(query, { $set: data })).modifiedCount;
  }
}
