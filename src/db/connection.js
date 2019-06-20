const mongoose = require('mongoose');

/**
 * Singleton class for creating two separete connections to databases
 * Used in models
 *
 * @property {mongoose.Connection} connectionAPI
 * @property {mongoose.Connection} connectionEvents
 */
class HawkDBConnections {
  /**
   *Creates an instance of HawkDBConnections.
   */
  constructor() {
    /**
     * Create placeholder connections to let load models before creating actual connection
     */
    this.connectionAPI = mongoose.createConnection();
    this.connectionEvents = mongoose.createConnection();
  }

  /**
   * Create database connections
   *
   * @param {string} mongoURLAPI - URL for Hawk API database
   * @param {string} mongoURLEvents - URL fof Hawk Events database
   * @param {object} config - config to pass to mongoose connection
   * @param {boolean} config.useNewUrlParser - use new mongoose url parser
   * @param {boolean} config.useCreateIndex - create index for models
   */
  async createConnections(
    mongoURLAPI,
    mongoURLEvents,
    config = {
      useNewUrlParser: true,
      useCreateIndex: true
    }
  ) {
    if (this.connectionAPI._state !== mongoose.STATES.connected) {
      this.connectionAPI = await mongoose.createConnection(mongoURLAPI, config);
    }

    if (this.connectionEvents._state !== mongoose.STATES.connected) {
      this.connectionEvents = await mongoose.createConnection(
        mongoURLEvents,
        config
      );
    }
  }
}

module.exports = new HawkDBConnections();
