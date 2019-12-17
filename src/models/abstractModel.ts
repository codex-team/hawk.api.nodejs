import { Collection } from 'mongodb';

/**
 * Base model
 */
export default abstract class Model<DBScheme> {
  /**
   * Creates model instance
   * @param modelData - data to fill model
   */
  protected constructor(modelData: DBScheme) {
    Object.assign(this, modelData);
  };

  /**
   * Model's collection
   * @todo make abstract when Microsoft implements abstract static getters
   * @see https://github.com/microsoft/TypeScript/issues/34516
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
  protected static async update(query: object, data: object): Promise<number> {
    return (await this.collection.updateOne(query, { $set: data })).modifiedCount;
  }
}
