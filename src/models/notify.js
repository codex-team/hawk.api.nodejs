/**
 * @typedef {Object} ProviderSettings
 * @property {Boolean} enabled - is provider enabled
 * @property {String} value - provider hook/email/etc
 * @property {ProviderTypes} provider - provider name
 */

/**
 * @typedef {Object} NotificationSettingsSchema
 * @property {ObjectID|string} id - notify ID
 * @property {ObjectID|string} [userId] - user ID
 * @property {ReceiveTypes} receiveType
 * @property {string} words - filter words when action type is INCLUDING
 * @property {ProviderSettings[]} providers - notify settings
 */

/**
 * @enum {string} What events to receive
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
  INCLUDING: 'INCLUDING',
};

/**
 * Supported provider types
 */
const ProviderTypes = {
  EMAIL: 'EMAIL',
  TELEGRAM: 'EMAIL',
  SLACK: 'SLACK',
};

/**
 * Notify model
 * Represents notify setting for given user and project
 */
class Notify {
  /**
   * Creates Notify instance
   * @param {NotificationSettingsSchema} schema - event's schema
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
   * @param {NotificationSettingsSchema} schema
   *
   * @returns {Notify[]}
   */
  fillModel(schema) {
    Object.keys(schema).forEach((prop) => {
      this[prop] = schema[prop];
    });
  }

  /**
   * Default notify settings
   */
  static getDefaultNotify() {
    console.log(ReceiveTypes.ALL);

    return [
      {
        _id: '1234141',
        isEnabled: true,
        whatToReceive: ReceiveTypes.ALL,
        including: ['codex', 'editor'],
        excluding: [ 'script error.' ],
        channels: {
          email: {
            isEnabled: true,
            endpoint: 'alerts@yourteam.com',
            minPeriod: 60,
          },
          slack: {
            isEnabled: true,
            endpoint: 'slack',
            minPeriod: 60,
          },
          telegram: {
            isEnabled: true,
            endpoint: 'telegram',
            minPeriod: 60,
          },
        },
      },
    ];
  }
}

module.exports = Notify;
