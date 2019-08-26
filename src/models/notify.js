/**
 * @typedef {Object} ProviderSettings
 * @property {Boolean} enabled - provider enabled?
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
   * @returns Event
   */
  fillModel(schema) {
    for (const prop in schema) {
      if (!schema.hasOwnProperty(prop)) {
        continue;
      }
      this[prop] = schema[prop];
    }
  }
}

module.exports = Notify;
