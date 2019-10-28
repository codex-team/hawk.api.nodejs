/**
 * @file Configuration for migrate-mongo (https://www.npmjs.com/package/migrate-mongo)
 */

require('./src/env');

const config = {
  mongodb: {
    url: process.env.MONGO_HAWK_DB_URL,
    databaseName: 'hawk',
    options: {
      /**
       * Removes a deprecation warning when connecting
       */
      useNewUrlParser: true,
      /**
       * Removes a deprecation warning when connecting
       */
      useUnifiedTopology: true
    }
  },

  /**
   * The migrations dir, can be an relative or absolute path. Only edit this when really necessary
   */
  migrationsDir: 'migrations',

  /**
   * The mongodb collection where the applied changes are stored. Only edit this when really necessary
   */
  changelogCollectionName: 'changelog'
};

module.exports = config;
