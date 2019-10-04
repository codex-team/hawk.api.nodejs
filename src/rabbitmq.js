const amqplib = require('amqp-connection-manager');
const debug = require('debug');
const rabbitMQURL = process.env.AMQP_URL;
let channel = null;
let connection = null;

/**
 * Setups connection to the RabbitMQ
 * @return {Promise<void>}
 */
async function setupConnections() {
  if (rabbitMQURL) {
    connection = amqplib.connect(rabbitMQURL);
    connection.on('connect', () => {
      if (!channel) {
        const channelWrapper = connection.createChannel({
          setup: ch => {
            channel = channelWrapper;
            console.log(`🔗 AMQP channel connected: ${rabbitMQURL}`);
          }
        });
      }
    });
    connection.on('disconnect', () => console.log('💥 AMQP disconnected. Trying to reconnect...'));
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
  try {
    await channel.publish(exchange, route, Buffer.from(message));
    debug(`Message sent: ${message}`);
  } catch (err) {
    console.log('Message was rejected:', err.stack);
  }
}

module.exports = {
  setupConnections,
  publish
};
