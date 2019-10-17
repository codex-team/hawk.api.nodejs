/**
 * @typedef {Object} ProviderSettings
 * @property {Boolean} enabled - is provider enabled
 * @property {String} value - provider hook/email/etc
 */

/**
 * @typedef {Object} NotifySettings
 * @property {ProviderSettings} email
 * @property {ProviderSettings} tg
 * @property {ProviderSettings} slack
 */

/**
 * @typedef {Object} NotifySchema
 * @property {ObjectID|string} id - notify ID
 * @property {ObjectID|string} [userId] - user ID
 * @property {number} actionType - action type. {ONLY_NEW: 1, ALL: 2, INCLUDING: 3}
 * @property {string} words - filter words when action type is INCLUDING
 * @property {NotifySettings} settings - notify settings
 */

/**
 * What events to receive
 * @type {{ALL: string, ONLY_NEW: string, INCLUDING: string}}
 */
const ReceiveTypes = {
  /**
   * Receive only new events
   */
  ONLY_NEW: 'ONLY_NEW',

  /**
   * Receive all events
   */
  ALL: 'ALL',

  /**
   * Receive events that includes words from list
   */
  INCLUDING: 'INCLUDING'
};

/**
 * Notify model
 * Represents notify setting for given user and project
 */
class Notify {
  /**
   * Creates Notify instance
   * @param {NotifySchema} schema - event's schema
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
   * @param {NotifySchema} schema
   *
   * @returns {Notify[]}
   */
  fillModel(schema) {
    Object.keys(schema).forEach((prop) => {
      this[prop] = schema[prop];
    });
  }

  /**
   * Default notify settings.
   * @returns {{actionType: ReceiveTypes, settings: {tg: {value: string, enabled: boolean}, slack: {value: string, enabled: boolean}, email: {value: string, enabled: boolean}}, words: string}}
   */
  static get defaultNotify() {
    return {
      receiveType: ReceiveTypes.ALL,
      providers: [
        {
          name: 'email',
          value: '',
          enabled: true
        }
      ]
    };
  }
}

module.exports = Notify;
