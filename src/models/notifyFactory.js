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

    this.collection = mongo.databases.hawk.collection('users-in-project:' + this.projectId);
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
   * @param {NotificationSettingsSchema} notify - Notify to update
   * @returns {Promise<Boolean>}
   */
  async update(notify) {
    if (!notify.userId) {
      throw new Error('Can not update Notify, because userId is not provided');
    }

    const updated = await this.collection.updateOne(
      { userId: new ObjectID(notify.userId) },
      { $set: { notify } },
      { upsert: true }
    );

    return updated.modifiedCount || updated.upsertedCount || updated.matchedCount;
  }

  /**
   * Create Notify
   *
   * @param {ObjectID} userId - User ID
   * @param {NotifyProvider} settings - Notify settings
   * @returns {Promise<Notify>}
   */
  async create(userId, settings = {}) {
    if (!userId) {
      throw new Error('Can not create Notify, because userId is not provided');
    }
    const inserted = await this.collection.insertOne({ userId, settings });

    return new Notify({ _id: inserted.insertedId, userId, settings });
  }

  /**
   * Delete notify
   * @param {ObjectID|string} userId - User ID
   * @returns {Promise<Boolean>}
   */
  async deleteOne(userId) {
    if (!userId) {
      throw new Error('Can not delete Notify, because userId is not provided');
    }

    return (await this.collection.deleteOne({ userId: new ObjectID(userId) })).deletedCount;
  }
}

module.exports = NotifyFactory;
