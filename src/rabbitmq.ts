import amqplib, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { Options } from 'amqplib';
import debug from 'debug';
import HawkCatcher from '@hawk.so/nodejs';

const rabbitMQURL = process.env.AMQP_URL;
let channel: ChannelWrapper;
let connection: AmqpConnectionManager;

/**
 * Rabbitmq exchanges
 */
export enum Exchanges {
  Errors = 'errors',
  Notify = 'notify',
  Stash = 'stash',
  Merchant = 'merchant',
  CronTasks = 'cron-tasks',
  Empty = '',
}

/**
 * Rabbitmq queues
 */
export enum Queues {
  Merchant = 'merchant/initialized',
  Email = 'sender/email',
  Telegram = 'notify/telegram',
  Slack = 'notify/slack',
  Loop = 'notify/loop',
  Limiter = 'cron-tasks/limiter',
}

/**
 * Contains a rabbitmq exchange and a queue for the worker
 */
export interface WorkerPath {
  /**
   * Rabbitmq exchange
   */
  exchange: string;

  /**
   * Rabbitmq queue
   */
  queue: string;
}

/**
 * Paths for workers to send events to the queue
 */
export const WorkerPaths: Record<string, WorkerPath> = {
  /**
   * Path to merchant worker
   */
  Merchant: {
    exchange: Exchanges.Merchant,
    queue: Queues.Merchant,
  },

  /**
   * Path to email worker
   */
  Email: {
    exchange: Exchanges.Empty,
    queue: Queues.Email,
  },

  /**
   * Path to telegram worker
   */
  Telegram: {
    exchange: Exchanges.Notify,
    queue: Queues.Telegram,
  },

  /**
   * Path to slack worker
   */
  Slack: {
    exchange: Exchanges.Notify,
    queue: Queues.Slack,
  },

  /**
   * Path to loop worker
   */
  Loop: {
    exchange: Exchanges.Notify,
    queue: Queues.Loop,
  },

  /**
   * Path to limiter worker
   */
  Limiter: {
    exchange: Exchanges.CronTasks,
    queue: Queues.Limiter,
  },
};

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
    connection.on('error', (error) => {
      HawkCatcher.send(error);
      console.error(error);
    });
    connection.on('disconnect', () => console.log('💥AMQP disconnected. Trying to reconnect...'));
  }
}

/**
 * Send message to RabbitMQ queue
 * @param exchange - exchange to publish message to
 * @param route - route to publish message to
 * @param message - message to publish
 * @param options - rabbitmq task options
 */
export async function publish(exchange: string, route: string, message: string, options?: Options.Publish): Promise<void> {
  try {
    await channel.publish(exchange, route, Buffer.from(message), options);
    debug(`Message sent: ${message}`);
  } catch (err) {
    HawkCatcher.send(err as Error);
    console.log('Message was rejected:', (err as Error).stack);
  }
}

/**
 * Put a background task into the queue on rabbitmq
 *
 * @param workerPath - worker rabbitmq path: exchange and queue
 * @param task - anything that we can stringify
 */
export async function enqueue(workerPath: WorkerPath, task: object, options?: Options.Publish): Promise<void> {
  await publish(workerPath.exchange, workerPath.queue, JSON.stringify(task), options);
}
