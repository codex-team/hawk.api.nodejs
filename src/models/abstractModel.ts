import { Collection } from 'mongodb';

export type ModelConstructor<DBScheme, Model extends BaseModel<DBScheme>> = new (modelData: DBScheme) => Model;

/**
 * Base model
 */
export default class BaseModel<DBScheme> {
  /**
   * Creates model instance
   * @param modelData - data to fill model
   */
  constructor(modelData: DBScheme) {
    Object.assign(this, modelData);
  };

  /**
   * Model's collection
   */
  static get collection(): Collection {
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
