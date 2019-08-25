const mongo = require('../mongo');
const Event = require('../models/event');
const { ObjectID } = require('mongodb');

/**
 * @typedef {Object} RecentEventSchema
 * @property {Event} event - event model
 * @property {Number} count - recent error occurred count
 * @property {String} data - error occurred date (string)
 */

/**
 * EventService
 */
class EventService {
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
   * @param type
   *
   * @returns {string}
   */
  getCollection(type) {
    return mongo.databases.events.collection(
      type + ':' + this.projectId
    );
  }

  /**
   * Finds events
   *
   * @param {object} [query={}] - query
   * @param {Number} [limit=10] - query limit
   * @param {Number} [skip=0] - query skip
   * @returns {Event[]} - events matching query
   */
  async find(query = {}, limit = 10, skip = 0) {
    const cursor = this.getCollection(this.TYPES.EVENTS)
      .find(query)
      .sort([ ['_id', -1] ])
      .limit(limit)
      .skip(skip);

    // Memory overflow?
    const result = await cursor.toArray();

    return result.map(data => {
      return Event.fillModel(data);
    });
  }

  /**
   * Find event by id
   *
   * @param {string|ObjectID} id - event id
   * @returns {Event} - event
   */
  async findById(id) {
    const searchResult = await this.getCollection(this.TYPES.EVENTS)
      .findOne({
        _id: new ObjectID(id)
      });

    return Event.fillModel(searchResult);
  }
  /**
   * Find event by any query
   *
   * @param {object} query - any custom mongo query
   * @return {Event}
   */
  async findOneByQuery(query) {
    const searchResult = await this.getCollection(this.TYPES.EVENTS)
      .findOne(query);

    return Event.fillModel(searchResult);
  }

  /**
   * @param limit
   * @return {RecentEventSchema[]}
   */
  async findRecent(limit) {
    const cursor = this.getCollection(this.TYPES.DAILY_EVENTS)
      .find({})
      .sort([ ['count', -1] ])
      .limit(limit);

    const result = await cursor.toArray();

    return Promise.all(result.map(async (data) => {
      const event = await this.findOneByQuery({
        groupHash: data.groupHash
      });

      return {
        event: event,
        count: data.count,
        date: data.currentDate
      };
    }));
  }
}

module.exports = EventService;
