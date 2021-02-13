const NodeEnvironment = require('jest-environment-node');
const mongodb = require('mongodb');

/**
 * Custom test environment for defining global connections
 */
class CustomEnvironment extends NodeEnvironment {
  /**
   * Setup environment
   * @return {Promise<void>}
   */
  async setup() {
    await super.setup();
    const mongoClient = new mongodb.MongoClient('mongodb://mongodb:27017', { useUnifiedTopology: true });

    await mongoClient.connect();
    this.global.mongoClient = mongoClient;
    await mongoClient.db('hawk').dropDatabase();
  }

  /**
   * Teardown environment
   * @return {Promise<void>}
   */
  async teardown() {
    await this.global.mongoClient.close();
    await super.teardown();
  }
}

module.exports = CustomEnvironment;
