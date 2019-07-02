const { ObjectID } = require('mongodb');
const mongo = require('../mongo');

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
 * @property {string|ObjectID} _id - event ID
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
 * Represents events for given project
 *
 * @property {string|ObjectID} projectId - project ID
 */
class Event {
  /**
   * Creates Event instance
   * @param {string|ObjectID} projectId - project ID
   */
  constructor(projectId) {
    if (!projectId) {
      throw new Error('projectId not provided');
    }
    this.projectId = new ObjectID(projectId);
    this.collection = mongo.databases.events.collection(
      'events:' + this.projectId
    );
  }

  /**
   * Finds events
   *
   * @param {object} [query={}] - query
   * @param {Number} [limit=10] - query limit
   * @param {Number} [skip=0] - query skip
   * @returns {EventSchema[]} - events matching query
   */
  async find(query = {}, limit = 10, skip = 0) {
    const cursor = this.collection
      .find(query)
      .limit(limit)
      .skip(skip);

    // Memory overflow?
    return cursor.toArray();
  }

  /**
   * Find event by id
   *
   * @param {string|ObjectID} id - event id
   * @returns {EventSchema} - event
   */
  async findById(id) {
    return this.collection.findOne({
      _id: new ObjectID(id)
    });
  }
}

module.exports = Event;
