import { Collection, Db, ObjectID } from 'mongodb';
import BaseModel, { ModelConstructor } from './abstractModel';

/**
 * Model Factory class
 */
export default class Factory<DBScheme, Model extends BaseModel<DBScheme>> {
  /**
   * Collection to work with
   */
  public collection: Collection;

  /**
   * Model constructor to create instances
   */
  private readonly model: ModelConstructor<DBScheme, Model>;

  /**
   * Creates factory instance
   * @param dbConnection - connection to DataBase
   * @param collectionName - database collection name
   * @param model - model constructor
   */
  constructor(dbConnection: Db, collectionName: string, model: ModelConstructor<DBScheme, Model>) {
    this.collection = dbConnection.collection(collectionName);
    this.model = model;
  }

  /**
   * Find record by query
   * @param query - query object
   */
  async findOne(query: object): Promise<Model | null> {
    const searchResult = await this.collection.findOne(query);

    if (!searchResult) {
      return null;
    }

    return new this.model(searchResult);
  }

  /**
   * Finds record by its id
   * @param id - entity id
   */
  async findById(id: string): Promise<Model | null> {
    const searchResult = await this.collection.findOne({
      _id: new ObjectID(id),
    });

    if (!searchResult) {
      return null;
    }

    return new this.model(searchResult);
  }
}
