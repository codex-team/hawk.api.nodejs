import { Collection, Db, Document } from 'mongodb';
import { databases } from '../mongo';

/**
 * Model constructor type
 */
export type ModelConstructor<DBScheme extends Document, Model extends AbstractModel<DBScheme>> = new (modelData: DBScheme) => Model;

/**
 * Base model
 */
export default abstract class AbstractModel<DBScheme extends Document> {
  /**
   * Database connection to interact with DB
   */
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  protected readonly dbConnection: Db = databases.hawk!;

  /**
   * Model's collection
   */
  protected abstract collection: Collection<DBScheme>;

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
   * @param data - update data (supports MongoDB dot notation for nested fields)
   * @return number of documents modified
   */
  public async update(query: object, data: Partial<DBScheme> | Record<string, any>): Promise<number> {
    /**
     * Type assertion is needed because MongoDB's updateOne accepts both
     * Partial<DBScheme> (for regular updates) and Record<string, any>
     * (for dot notation like 'identities.workspaceId.saml.id'), but the
     * type system requires MatchKeysAndValues<DBScheme>.
     */
    return (await this.collection.updateOne(query, { $set: data as any })).modifiedCount;
  }
}
