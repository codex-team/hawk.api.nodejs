const amqplib = require('amqplib');

const rabbitMQURL = process.env.AMQP_URL;
let channel = null;

/**
 * Setups connection to the RabbitMQ
 * @return {Promise<void>}
 */
async function setupConnections() {
  if (rabbitMQURL) {
    return amqplib.connect(rabbitMQURL)
      .then(conn => conn.createChannel())
      .then(ch => {
        channel = ch;
      });
  }
  return null;
}

/**
 * Send message to RabbitMQ queue
 * @param exchange
 * @param route
 * @param message
 * @return {Promise<*>}
 */
async function publish(exchange, route, message) {
  return channel.publish(exchange, route, Buffer.from(message));
}

module.exports = {
  setupConnections,
  publish
};
