const mongoose = require('mongoose');

/**
 * Singleton class for creating two separete connections to databases
 * Used in models
 *
 * @property {monoose.Connection} connectionAPI
 * @property {monoose.Connection} connectionEvents
 */
class HawkConnections {
  /**
   *Creates an instance of HawkConnections.
   */
  constructor() {
    this.connectionAPI = mongoose.createConnection(process.env.MONGO_URL_API);
    this.connectionEvents = mongoose.createConnection(
      process.env.MONGO_URL_EVENTS
    );
  }
}

module.exports = new HawkConnections();
