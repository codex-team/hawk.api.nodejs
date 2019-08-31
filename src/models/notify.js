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
 * @property {ObjectID} id - notify ID
 * @property {ObjectID} userId - user ID
 * @property {number} actionType - action type. {ONLY_NEW: 1, ALL: 2, INCLUDING: 3}
 * @property {string} words - filter words when action type is INCLUDING
 * @property {NotifySettings} settings - notify settings
 */

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
   * @returns {{actionType: number, settings: {tg: {value: string, enabled: boolean}, slack: {value: string, enabled: boolean}, email: {value: string, enabled: boolean}}, words: string}}
   */
  static get defaultNotify() {
    return {
      actionType: 1,
      words: '',
      settings: {
        email: {
          value: '',
          enabled: true
        },
        tg: {
          value: '',
          enabled: false
        },
        slack: {
          value: '',
          enabled: false
        }
      }
    };
  }
}

module.exports = Notify;
