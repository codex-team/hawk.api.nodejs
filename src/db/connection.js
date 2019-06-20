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
    // Logging if in development
    if (process.env.NODE_ENV === 'development') {
      // Events to log
      const events = ['connected', 'close', 'error', 'disconnecting'];

      [this.connectionAPI, this.connectionEvents].forEach(conn => {
        events.forEach(event => {
          conn.on(event, data => {
            if (data) {
              console.log(
                `[mongo ${conn.host}:${conn.port}/${
                  conn.name
                }] ${event}\n ${data}`
              );
            } else {
              console.log(
                `[mongo ${conn.host}:${conn.port}/${conn.name}] ${event}`
              );
            }
          });
        });
      });
    }

    if (this.connectionAPI.readyState !== mongoose.STATES.connected) {
      await this.connectionAPI.openUri(mongoURLAPI, config);
    }

    if (this.connectionEvents.readyState !== mongoose.STATES.connected) {
      await this.connectionEvents.openUri(mongoURLEvents, config);
    }
  }

  /**
   * Close connectons
   *
   * @returns Promise<void>
   */
  close() {
    return Promise.all(
      [this.connectionAPI, this.connectionEvents].map(conn => conn.close())
    );
  }
}

module.exports = new HawkDBConnections();
