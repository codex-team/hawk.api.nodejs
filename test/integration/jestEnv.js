const NodeEnvironment = require('jest-environment-node');
const amqp = require('amqplib');
const mongodb = require('mongodb');
const { installRedisMock, uninstallRedisMock } = require('./redisMock');

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

    /**
     * Add performance API polyfill for MongoDB driver
     * MongoDB driver uses performance.now() which is not available in Jest environment by default
     */
    const { performance } = require('perf_hooks');
    this.global.performance = performance;

    const mongoClient = new mongodb.MongoClient('mongodb://mongodb:27017', { useUnifiedTopology: true });

    await mongoClient.connect();
    this.global.mongoClient = mongoClient;
    await mongoClient.db('hawk').dropDatabase();
    // await mongoClient.db('codex_accounting').dropDatabase();

    /**
     * Use redis-mock instead of a real Redis connection.
     * This avoids spinning up Redis during integration tests while keeping the API surface.
     */
    this.global.redisClient = installRedisMock();

    this.rabbitMqConnection = await amqp.connect('amqp://guest:guest@rabbitmq:5672/');
    this.global.rabbitChannel = await this.rabbitMqConnection.createChannel();
    await this.global.rabbitChannel.purgeQueue('cron-tasks/limiter');
  }

  /**
   * Teardown environment
   * @return {Promise<void>}
   */
  async teardown() {
    try {
      if (this.global.mongoClient) {
        await this.global.mongoClient.close();
      }

      if (this.global.rabbitChannel) {
        await this.global.rabbitChannel.close();
      }

      if (this.rabbitMqConnection) {
        await this.rabbitMqConnection.close();
      }

      uninstallRedisMock();
    } catch (error) {
      console.error('Error during teardown:', error);
    }

    await super.teardown();
  }
}

module.exports = CustomEnvironment;
