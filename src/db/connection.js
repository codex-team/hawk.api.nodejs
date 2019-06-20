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
   * Create database connections
   *
   * @param {string} mongoURLAPI
   * @param {string} mongoURLEvents
   */
  createConnections(mongoURLAPI, mongoURLEvents) {
    if (!this.connectionAPI) {
      this.connectionAPI = mongoose.createConnection(mongoURLAPI, {
        useNewUrlParser: true,
        useCreateIndex: true,
        useFindAndModify: false
      });
    }

    if (!this.connectionEvents) {
      this.connectionEvents = mongoose.createConnection(mongoURLEvents, {
        useNewUrlParser: true,
        useCreateIndex: true,
        useFindAndModify: false
      });
    }
  }
}

module.exports = new HawkDBConnections();
