import { Collection, Db, ObjectID } from 'mongodb';
import BaseModel, { ModelConstructor } from './abstractModel';

/**
 * Model Factory class
 */
export default abstract class Factory<DBScheme, Model extends BaseModel<DBScheme>> {
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
   * We can't use generic type for collection because of bug in TS
   * @see {@link https://github.com/DefinitelyTyped/DefinitelyTyped/issues/39358#issuecomment-546559564}
   * So we should override collection type in child classes
   */
  protected abstract collection: Collection;

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

    return new this.Model(searchResult);
  }

  /**
   * Finds record by its id
   * @param id - entity id
   */
  public async findById(id: string): Promise<Model | null> {
    const searchResult = await this.collection.findOne({
      _id: new ObjectID(id),
    });

    if (!searchResult) {
      return null;
    }

    return new this.Model(searchResult);
  }
}
