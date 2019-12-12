import {Collection, Db, ObjectID} from "mongodb";
import BaseModel from './abstractModel'

/**
 * Model Factory class
 */
export default class Factory<DBScheme> {
  /**
   * Collection to work with
   */
  private collection: Collection;

  /**
   * Model constructor to create instances
   */
  private readonly model: typeof BaseModel;

  constructor(dbConnection: Db, collectionName: string, model: typeof BaseModel) {
    this.collection = dbConnection.collection(collectionName);
    this.model = model;
  }

  /**
   * Find record by query
   * @param query - query object
   */
  async findOne(query: object): Promise<BaseModel<DBScheme> | null> {
    const searchResult = await this.collection.findOne(query);

    if (!searchResult) return null;

    return new this.model(searchResult);
  }

  /**
   * Finds record by its id
   * @param id - entity id
   */
  async findById(id: string): Promise<BaseModel<DBScheme> | null> {
    const searchResult = await this.collection.findOne({
      _id: new ObjectID(id)
    });

    return new this.model(searchResult);
  }
}
