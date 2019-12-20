import { Collection, Db, ObjectID } from 'mongodb';
import BaseModel, { ModelConstructor } from './abstractModel';

/**
 * Model Factory class
 */
export default abstract class Factory<DBScheme, Model extends BaseModel<DBScheme>> {
  /**
   * Collection to work with
   */
  protected collection: Collection;

  /**
   * Model constructor to create instances
   */
  private readonly Model: ModelConstructor<DBScheme, Model>;

  /**
   * Creates factory instance
   * @param dbConnection - connection to DataBase
   * @param collectionName - database collection name
   * @param model - model constructor
   */
  protected constructor(dbConnection: Db, collectionName: string, model: ModelConstructor<DBScheme, Model>) {
    this.collection = dbConnection.collection(collectionName);
    this.Model = model;
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
