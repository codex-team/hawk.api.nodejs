import amqplib, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import debug from 'debug';

const rabbitMQURL = process.env.AMQP_URL;
let channel: ChannelWrapper;
let connection: AmqpConnectionManager;

/**
 * Setups connection to the RabbitMQ
 */
export async function setupConnections(): Promise<void> {
  if (rabbitMQURL) {
    connection = amqplib.connect([ rabbitMQURL ]);
    connection.on('connect', () => {
      if (!channel) {
        const channelWrapper = connection.createChannel({
          setup: () => {
            channel = channelWrapper;
            console.log(`🔗AMQP channel connected: ${rabbitMQURL}`);
          },
        });
      }
    });
    connection.on('disconnect', () => console.log('💥AMQP disconnected. Trying to reconnect...'));
  }
}

/**
 * Send message to RabbitMQ queue
 * @param exchange
 * @param route
 * @param message
 */
export async function publish(exchange: string, route: string, message: string): Promise<void> {
  try {
    await channel.publish(exchange, route, Buffer.from(message));
    debug(`Message sent: ${message}`);
  } catch (err) {
    console.log('Message was rejected:', err.stack);
  }
}
