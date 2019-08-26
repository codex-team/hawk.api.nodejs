const mongo = require('../mongo');
const Notify = require('./notify');
const { ObjectID } = require('mongodb');

// const _ = require('lodash');

/**
 * NotifyFactory
 *
 * Creational class for Notify's Model
 */
class NotifyFactory {
  /**
   * Creates NotifyFactory instance
   * @param {string|ObjectID} userId
   */
  constructor(userId) {
    if (!userId) {
      throw new Error('Can not construct Notify model, because userId is not provided');
    }
    this.userId = userId;

    this.collection = mongo.databases.hawk.collection('notifies:' + this.userId);
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
   * Find Notify by project ID
   *
   * @param projectId
   * @returns {Promise<Notify>}
   */
  async findByProjectId(projectId) {
    const searchResult = await this.collection.findOne({ projectId: new ObjectID(projectId) });

    return new Notify(searchResult);
  }

  /**
   * Converts nested objects to one objects with properties as paths to nested props
   * Example:
   *
   * objectToPath({projectId: ObjectID("5d63c84aa17ed33e62ed2edb"), settings: {email: {enabled: true}}})
   *
   * // { projectId: 5d63c84aa17ed33e62ed2edb, 'settings.email.enabled': true }
   * @param obj - Object
   * @param [curr] - current property
   * @param [dict] - result
   */
  static propsToPaths(obj, curr = null, dict = {}) {
    Object.keys(obj).forEach((key) => {
      if (typeof (obj[key]) === 'object' && !(obj[key] instanceof ObjectID)) {
        this.propsToPaths(obj[key], curr ? `${curr}.${key}` : key, dict);
      } else {
        dict[curr ? `${curr}.${key}` : key] = obj[key];
      }
    });
    return dict;
  }

  /**
   * Update Notify
   *
   * @param {Notify} notify - Notify to update
   * @returns {Promise<Notify|null>}
   */
  async update(notify) {
    if (!notify.projectId) {
      throw new Error('Can not update Notify, because projectId is not provided');
    }

    const updated = await this.collection.updateOne({ projectId: notify.projectId }, { $set: NotifyFactory.propsToPaths(notify) });

    if (updated.matchedCount === 0) {
      return null;
    }

    return true;
  }

  /**
   * Create Notify
   *
   * @param {ObjectID} projectId - Project ID
   * @param {NotifySettings} settings - Notify settings
   * @returns {Promise<Notify>}
   */
  async create(projectId, settings = {}) {
    if (!projectId) {
      throw new Error('Can not create Notify, because projectId is not provided');
    }
    const inserted = await this.collection.insertOne({ projectId, settings });

    return new Notify({ _id: inserted.insertedId, projectId, settings });
  }

  /**
   * Validates limit value
   * @param limit
   * @return {Number}
   */
  validateLimit(limit) {
    limit = Math.max(0, limit);

    if (limit > 100) {
      throw Error('Invalid limit value');
    }

    return limit;
  }

  /**
   * Validate skip value
   * @param skip
   * @return {Number}
   */
  validateSkip(skip) {
    skip = Math.max(0, skip);

    if (skip > 100) {
      throw Error('Invalid skip value');
    }

    return skip;
  }
}

module.exports = NotifyFactory;
