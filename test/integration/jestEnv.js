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

    this.rabbitMqConnection = await amqp.connect('amqp://guest:guest@rabbitmq:5672/');
    this.global.rabbitChannel = await this.rabbitMqConnection.createChannel();
  }

  /**
   * Teardown environment
   * @return {Promise<void>}
   */
  async teardown() {
    await this.global.mongoClient.close();
    await this.global.rabbitChannel.close();
    await this.rabbitMqConnection.close();
    await super.teardown();
  }
}

module.exports = CustomEnvironment;
