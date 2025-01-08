const NodeEnvironment = require('jest-environment-node');
const amqp = require('amqplib');
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
    // await mongoClient.db('codex_accounting').dropDatabase();

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
    } catch (error) {
      console.error('Error during teardown:', error);
    }

    await super.teardown();
  }
}

module.exports = CustomEnvironment;
