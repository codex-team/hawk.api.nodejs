/**
 * @typedef {Object} BacktraceSourceCode
 * @property {Number} line - line's number
 * @property {string} content - line's content
 */

/**
 * @typedef {Object} EventBacktraceFrame
 * @property {string} file - source filepath
 * @property {Number} line - called line
 * @property {Number} column - called column
 * @property {BacktraceSourceCode[]} [sourceCode] - part of source code file near the called line
 * Pro
 */

/**
 * @typedef {Object} EventUser
 * @property {Number} id
 * @property {string} name
 * @property {string} url
 * @property {string} photo
 */

/**
 * @typedef {Object} EventPayload
 * @property {string} title - event title
 * @property {Number} level - event severity level
 * @property {EventBacktraceFrame[]} [backtrace] - event stack array from the latest call to the earliest
 * @property {Object} [get] - GET params
 * @property {Object} [post] - POST params
 * @property {Object} [headers] - HTTP headers
 * @property {String} [release] - source code version identifier; version, modify timestamp or both of them combined
 * @property {EventUser} [user] - current authenticated user
 * @property {Object} [context] - any additional data
 * @property {Object} [addons] - catcher-specific fields
 */

/**
 * @typedef {Object} EventSchema
 * @property {String} _id - event ID
 * @property {String} groupHash - event's hash (catcherType + title + salt)
 * @property {Number} totalCount - event repetitions count
 * @property {String} catcherType - type of an event
 * @property {EventPayload} payload - event's payload
 * @property {Number} timestamp - event's Unix timestamp
 * @property {Number} usersAffected - number of users that were affected by the event
 * @property {User[]} visitedBy - array of users who visited this event
 */

/**
 * Event model
 * Represents events for given project
 *
 * @implements EventSchema
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
   * Fills current instance with schema properties
   * @param {EventSchema} schema
   *
   * @returns Event
   */
  fillModel(schema) {
    Object.keys(schema).forEach(prop => {
      this[prop] = schema[prop];
    });
  }
}

module.exports = Event;
