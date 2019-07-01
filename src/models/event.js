const { ObjectID } = require('mongodb');
const mongo = require('../mongo');
const { pickTo } = require('../utils');

/**
 * @typedef {Object} BacktraceSourceCode
 * @property {Number} line - line's number
 * @property {string} content - line's content
 */

/**
 * @typedef {Object} EventBacktrace
 * @property {string} file - source filepath
 * @property {Number} line - called line
 * @property {BacktraceSourceCode[]} [sourceCode] - part of source code file near the called line
 */

/**
 * @typedef {Object} EventUser
 * @property {Number} id
 * @property {string} name
 * @property {string} url
 * @property {string} photo
 */

/**
 * @typedef {Object} EventSchema
 * @property {string} catcherType - type of an event
 * @property {Object} payload - event data
 * @property {string} payload.title - event title
 * @property {Date} payload.timestamp - event datetime
 * @property {Number} payload.level - event severity level
 * @property {EventBacktrace[]} [payload.backtrace] - event stack array from the latest call to the earliest
 * @property {Object} [payload.get] - GET params
 * @property {Object} [payload.post] - POST params
 * @property {Object} [payload.headers] - HTTP headers
 * @property {string} [payload.release] - source code version identifier; version, modify timestamp or both of them combined
 * @property {EventUser} [payload.user] - current authenticated user
 * @property {Object} [payload.context] - any additional data
 */

/**
 * Event model
 */
class Event {
  /**
   * Creates Event instance
   * @param {EventSchema} eventData - event data
   */
  constructor(eventData) {
    if (!eventData) {
      throw new Error('eventData not provided');
    }
    pickTo(this, eventData, 'catcherType', 'payload');
  }

  /**
   * Model's collection
   * @return {Collection}
   */
  static get collection() {
    return mongo.databases.events.collection('events');
  }

  /**
   * Finds events by token
   *
   * @param {string} token - event token
   */
  static async findByToken({ token, limit = 10, skip = 0 } = {}) {
    const cursor = this.collection.find({ token }, { limit, skip });

    // Memory overflow?
    return cursor.toArray();
  }

  /**
   * Find event by id
   *
   * @param {string|ObjectID} id - event id
   */
  static async findById(id) {
    const seachResult = await this.collection.findOne({
      _id: new ObjectID(id)
    });

    return new Event({ id: seachResult._id, ...seachResult });
  }
}

module.exports = Event;
