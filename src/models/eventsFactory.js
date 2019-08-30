const mongo = require('../mongo');
const Event = require('../models/event');
const { ObjectID } = require('mongodb');
const _ = require('lodash');

/**
 * @typedef {Object} RecentEventSchema
 * @property {Event} event - event model
 * @property {Number} count - recent error occurred count
 * @property {String} data - error occurred date (string)
 */

/**
 * EventsFactory
 *
 * Creational Class for Event's Model
 */
class EventsFactory {
  /**
   * @return {{EVENTS: string, DAILY_EVENTS: string, REPETITIONS: string}}
   * @constructor
   */
  get TYPES() {
    return {
      EVENTS: 'events',
      REPETITIONS: 'repetitions',
      DAILY_EVENTS: 'dailyEvents'
    };
  }

  /**
   * Creates Event instance
   * @param {string|ObjectID} projectId - project ID
   */
  constructor(projectId) {
    if (!projectId) {
      throw new Error('Can not construct Event model, because projectId is not provided');
    }
    this.projectId = new ObjectID(projectId);
  }

  /**
   * Returns pointer to the collection
   *
   * @param {String} type - each events in order to optimization holds data in different collections.
   *                      This argument defines which collection need to be used.
   *
   * @returns {String}
   */
  getCollection(type) {
    return mongo.databases.events.collection(
      type + ':' + this.projectId
    );
  }

  /**
   * Finds events by passed query
   *
   * @param {object} [query={}] - query
   * @param {Number} [limit=10] - query limit
   * @param {Number} [skip=0] - query skip
   * @returns {Event[]} - events matching query
   */
  async find(query = {}, limit = 10, skip = 0) {
    limit = this.validateLimit(limit);
    skip = this.validateSkip(skip);

    const cursor = this.getCollection(this.TYPES.EVENTS)
      .find(query)
      .sort([ ['_id', -1] ])
      .limit(limit)
      .skip(skip);

    const result = await cursor.toArray();

    return result.map(data => {
      return new Event(data);
    });
  }

  /**
   * Find event by id
   *
   * @param {string|ObjectID} id - event's id
   * @returns {Event}
   */
  async findById(id) {
    const searchResult = await this.getCollection(this.TYPES.EVENTS)
      .findOne({
        _id: new ObjectID(id)
      });

    return new Event(searchResult);
  }

  /**
   * Find an event by any custom query
   *
   * @param {object} query - any custom mongo query
   * @return {Event}
   */
  async findOneByQuery(query) {
    const searchResult = await this.getCollection(this.TYPES.EVENTS)
      .findOne(query);

    return new Event(searchResult);
  }

  /**
   * Returns events that grouped by day
   *
   * @param {Number} limit - events count limitations
   * @return {RecentEventSchema[]}
   */
  async findRecent(limit = 10) {
    limit = this.validateLimit(limit);

    const cursor = this.getCollection(this.TYPES.DAILY_EVENTS).aggregate([
      { $sort: { _id: -1, count: -1 } },
      { $limit: limit },
      {
        $group: {
          _id: null,
          groupHash: { $addToSet: '$groupHash' },
          dailyInfo: { $push: '$$ROOT' }
        }
      },
      {
        $lookup: {
          from: 'events:' + this.projectId,
          localField: 'groupHash',
          foreignField: 'groupHash',
          as: 'events'
        }
      }
    ]);

    return cursor.toArray();
  }

  /**
   * Returns Event's repetitions
   *
   * @param {string|ObjectID} eventId - Event's id
   * @param {Number} limit - count limitations
   * @param {Number} skip - selection offset
   *
   * @return {Event}
   */
  async getRepetitions(eventId, limit = 10, skip = 0) {
    limit = this.validateLimit(limit);
    skip = this.validateSkip(skip);

    const eventOriginal = await this.findById(eventId);
    const cursor = this.getCollection(this.TYPES.REPETITIONS)
      .find({
        groupHash: eventOriginal.groupHash
      })
      .sort([ ['_id', -1] ])
      .limit(limit)
      .skip(skip);

    const result = await cursor.toArray();

    return result.map(data => {
      delete data._id;
      delete data.groupHash;

      eventOriginal.payload = _.merge({}, eventOriginal.payload, data);
      return new Event(eventOriginal);
    });
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

module.exports = EventsFactory;
