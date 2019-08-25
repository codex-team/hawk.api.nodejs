const mongo = require('../mongo');
const Event = require('../models/event');
const { ObjectID } = require('mongodb');

/**
 * EventService
 */
class EventService {
  /**
   * @return {{EVENTS: string, DAILYEVENTS: string, REPETITIONS: string}}
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
    const searchResult = this.getCollection(this.TYPES.EVENTS)
      .findOne({
        _id: new ObjectID(id)
      });

    return Event.fillModel(searchResult);
  }
}

module.exports = EventService;
