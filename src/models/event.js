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
 * @property {String} id - event ID
 * @property {String} catcherType - type of an event
 * @property {Number} count - event repetitions count
 * @property {String} groupHash - event's hash (catcherType + title + salt)
 * @property {Object} payload - event data
 * @property {string} payload.title - event title
 * @property {Date} payload.timestamp - event datetime
 * @property {Number} payload.level - event severity level
 * @property {EventBacktrace[]} [payload.backtrace] - event stack array from the latest call to the earliest
 * @property {Object} [payload.get] - GET params
 * @property {Object} [payload.post] - POST params
 * @property {Object} [payload.headers] - HTTP headers
 * @property {String} [payload.release] - source code version identifier; version, modify timestamp or both of them combined
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
   * @param {EventSchema} schema - event's schema
   */
  constructor(schema = {}) {
    if (schema) {
      this.fillModel(schema);
    }
  }

  /**
   * @return {string|ObjectID}
   */
  get id() {
    return this._id;
  }

  /**
   * Fills current instance with schema properties
   * @param {EventSchema} schema
   *
   * @returns Event
   */
  fillModel(schema) {
    for (const prop in schema) {
      if (!Object.prototype.hasOwnProperty.call(schema, prop)) {
        continue;
      }
      this[prop] = schema[prop];
    }
  }
}

module.exports = Event;
