const { propsToPaths } = require('../utils/object');
const Factory = require('./modelFactory');
const mongo = require('../mongo');
const Notify = require('./notify');
const { ObjectID } = require('mongodb');

/**
 * NotifyFactory
 *
 * Creational class for Notify's Model
 */
class NotifyFactory extends Factory {
  /**
   * Creates NotifyFactory instance
   * @param {string|ObjectID} projectId
   */
  constructor(projectId) {
    super();
    if (!projectId) {
      throw new Error('Can not construct Notify model, because projectId is not provided');
    }
    this.projectId = projectId;

    this.collection = mongo.databases.hawk.collection('notifies:' + this.projectId);
  }

  /**
   * Find Notify by passed query
   *
   * @param {object} [query={}] - query
   * @param {Number} [limit=10] - query limit
   * @param {Number} [skip=0] - query skip
   * @returns {Promise<Notify[]>}
   */
  async find(query = {}, limit = 10, skip = 0) {
    limit = this.validateLimit(limit);
    skip = this.validateSkip(skip);

    const cursor = this.collection
      .find(query)
      .limit(limit)
      .skip(skip);

    const result = await cursor.toArray();

    return result.map(data => {
      return new Notify(data);
    });
  }

  /**
   * Find Notify by user ID
   *
   * @param {string} userId - User ID
   * @returns {Promise<Notify|null>}
   */
  async findByUserId(userId) {
    const searchResult = await this.collection.findOne({ userId: new ObjectID(userId) });

    return searchResult ? new Notify(searchResult) : null;
  }

  /**
   * Update Notify
   *
   * @param {Notify} notify - Notify to update
   * @returns {Promise<Boolean|null>}
   */
  async update(notify) {
    if (!notify.userId) {
      throw new Error('Can not update Notify, because userId is not provided');
    }

    const updated = await this.collection.updateOne({ userId: notify.userId }, { $set: propsToPaths(notify) }, { upsert: true });

    if (!(updated.matchedCount || updated.upsertedCount)) {
      return false;
    }

    return true;
  }

  /**
   * Create Notify
   *
   * @param {ObjectID} userId - User ID
   * @param {NotifySettings} settings - Notify settings
   * @returns {Promise<Notify>}
   */
  async create(userId, settings = {}) {
    if (!userId) {
      throw new Error('Can not create Notify, because userId is not provided');
    }
    const inserted = await this.collection.insertOne({ userId, settings });

    return new Notify({ _id: inserted.insertedId, userId, settings });
  }
}

module.exports = NotifyFactory;
