import { Collection, Db, Document, ObjectId } from 'mongodb';
import AbstractModel, { ModelConstructor } from './abstractModel';

/**
 * Model Factory class
 */
export default abstract class AbstractModelFactory<DBScheme extends Document, Model extends AbstractModel<DBScheme>> {
  /**
   * Database connection to interact with
   */
  protected dbConnection: Db;

  /**
   * Model constructor to create instances
   */
  private readonly Model: ModelConstructor<DBScheme, Model>;

  /**
   * Collection to work with
   */
  protected abstract collection: Collection<DBScheme>;

  /**
   * Creates factory instance
   * @param dbConnection - connection to DataBase
   * @param model - model constructor
   */
  protected constructor(dbConnection: Db, model: ModelConstructor<DBScheme, Model>) {
    this.Model = model;
    this.dbConnection = dbConnection;
  }

  /**
   * Find record by query
   * @param query - query object
   */
  public async findOne(query: object): Promise<Model | null> {
    const searchResult = await this.collection.findOne(query);

    if (!searchResult) {
      return null;
    }

    /**
     * MongoDB returns WithId<DBScheme>, but Model constructor expects DBScheme.
     * Since WithId<DBScheme> is DBScheme & { _id: ObjectId } and DBScheme already
     * includes _id: ObjectId, they are structurally compatible.
     */
    return new this.Model(searchResult as DBScheme);
  }

  /**
   * Finds record by its id
   * @param id - entity id
   */
  public async findById(id: string): Promise<Model | null> {
    const searchResult = await this.collection.findOne({
      _id: new ObjectId(id),
    } as any);

    if (!searchResult) {
      return null;
    }

    /**
     * MongoDB returns WithId<DBScheme>, but Model constructor expects DBScheme.
     * Since WithId<DBScheme> is DBScheme & { _id: ObjectId } and DBScheme already
     * includes _id: ObjectId, they are structurally compatible.
     */
    return new this.Model(searchResult as DBScheme);
  }
}
