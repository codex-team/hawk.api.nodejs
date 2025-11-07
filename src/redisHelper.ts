import HawkCatcher from '@hawk.so/nodejs';
import { createClient, RedisClientType } from 'redis';
import { Effect, sgr } from './utils/ansi';

/**
 * Helper class for working with Redis
 */
export default class RedisHelper {
  /**
   * TTL for lock records in Redis (in seconds)
   */
  private static readonly LOCK_TTL = 10;

  /**
   * Singleton instance
   */
  private static instance: RedisHelper | null = null;

  /**
   * Redis client instance
   */
  private redisClient!: RedisClientType;

  /**
   * Flag to track if we're currently reconnecting
   */
  private isReconnecting = false;

  /**
   * Constructor
   * Initializes the Redis client and sets up error handling with auto-reconnect
   */
  constructor() {
    try {
      this.redisClient = createClient({
        url: process.env.REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            // Exponential backoff: wait longer between each retry
            // Max wait time: 30 seconds
            const delay = Math.min(retries * 1000, 30000);
            console.log(`[Redis] Reconnecting... attempt ${retries}, waiting ${delay}ms`);
            return delay;
          },
        },
      });

      // Handle connection errors
      this.redisClient.on('error', (error) => {
        console.error('[Redis] Client error:', error);
        if (error) {
          HawkCatcher.send(error);
        }
      });

      // Handle successful reconnection
      this.redisClient.on('ready', () => {
        console.log('[Redis] Client ready');
        this.isReconnecting = false;
      });

      // Handle reconnecting event
      this.redisClient.on('reconnecting', () => {
        console.log('[Redis] Client reconnecting...');
        this.isReconnecting = true;
      });

      // Handle connection end
      this.redisClient.on('end', () => {
        console.log('[Redis] Connection ended');
      });
    } catch (error) {
      console.error('[Redis] Error creating client:', error);
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): RedisHelper {
    if (!RedisHelper.instance) {
      RedisHelper.instance = new RedisHelper();
    }
    return RedisHelper.instance;
  }

  /**
   * Connect to Redis
   */
  public async initialize(): Promise<void> {
    try {
      if (!this.redisClient.isOpen && !this.isReconnecting) {
        await this.redisClient.connect();
        console.log('[Redis] Connected successfully');
      }
    } catch (error) {
      console.error('[Redis] Connection failed:', error);
      HawkCatcher.send(error as Error);
      // Don't throw - let reconnectStrategy handle it
    }
  }

  /**
   * Close Redis client
   */
  public async close(): Promise<void> {
    if (this.redisClient.isOpen) {
      await this.redisClient.quit();
      console.log('[Redis] Connection closed');
    }
  }

  /**
   * Check if Redis is connected
   */
  public isConnected(): boolean {
    return this.redisClient.isOpen;
  }

  /**
   * Execute TS.RANGE command with aggregation
   *
   * @param key - Redis TimeSeries key
   * @param start - start timestamp in milliseconds
   * @param end - end timestamp in milliseconds
   * @param aggregationType - aggregation type (sum, avg, min, max, etc.)
   * @param bucketMs - bucket size in milliseconds
   * @returns Array of [timestamp, value] tuples
   */
  public async tsRange(
    key: string,
    start: string,
    end: string,
    aggregationType: string,
    bucketMs: string
  ): Promise<[string, string][]> {
    return (await this.redisClient.sendCommand([
      'TS.RANGE',
      key,
      start,
      end,
      'AGGREGATION',
      aggregationType,
      bucketMs,
    ])) as [string, string][];
  }
}