const mongo = require('../mongo');
const mongodbDriver = require('mongodb');
const ObjectID = mongodbDriver.ObjectID;

/**
 * @typedef {Object} BaseModel
 * @typedef {string|ObjectID} id - record id
 */

/**
 * Base model
 */
class Model {
  /**
   * Model's collection
   *
   * @return {Collection}
   */
  static get collection() {
    throw new Error('Collection method is not implemented');
  }

  /**
   * Find record by query
   * @param {object} query - query object
   * @return {Promise<User>|null}
   */
  static async findOne(query) {
    const searchResult = await this.collection.findOne(query);

    if (!searchResult) return null;

    return new this({
      id: searchResult._id,
      ...searchResult
    });
  }

  /**
   * Finds record by its id
   * @param {BaseModel.id} id - record's id
   * @return {Promise<BaseModel>}
   */
  static async findById(id) {
    const searchResult = await this.collection.findOne({
      _id: new ObjectID(id)
    });

    return new this({
      id: searchResult._id,
      ...searchResult
    });
  }

  /**
   * Update workspace data
   *
   * @param {object} query - query to match
   * @param {object} data - update data
   * @returns {Promise<number>} - number of documents modified
   */
  static async update(query, data) {
    return (await this.collection.updateOne(query, { $set: data })).modifiedCount;
  }
}

module.exports = Model;
