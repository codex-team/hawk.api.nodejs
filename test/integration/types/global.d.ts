/* eslint-disable @typescript-eslint/no-unused-vars */
import type { MongoClient } from 'mongodb';
import { Channel } from 'amqplib';

/**
 * Defines global variables for using in tests
 */
declare global {
  namespace NodeJS {
    interface Global {
      /**
       * MongoDB client instance
       */
      mongoClient: MongoClient;

      /**
       * RabbitMQ client instance
       */
      rabbitChannel: Channel;
    }
  }
}
