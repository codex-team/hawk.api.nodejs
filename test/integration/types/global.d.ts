/* eslint-disable no-var */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { MongoClient } from 'mongodb';
import { Channel } from 'amqplib';

/**
 * Defines global variables for using in tests
 */
declare global {
  /**
   * MongoDB client instance
   */
  var mongoClient: MongoClient;

  /**
   * RabbitMQ channel instance
   */
  var rabbitChannel: Channel;

  /**
   * Redis client instance (mock)
   */
  var redisClient: unknown;

  /**
   * Performance API for MongoDB driver
   */
  var performance: Performance;
}
