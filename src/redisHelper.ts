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
  
  public async getChartDataFromRedis(
    startDate: string,
    endDate: string,
    groupBy: number, // minutes: 1=minute, 60=hour, 1440=day
    timezoneOffset = 0,
    projectId = '',
    groupHash = ''
  ): Promise<{ timestamp: number; count: number }[]> {
    // If Redis is not connected, throw error to fallback to MongoDB
    if (!this.redisClient.isOpen) {
      console.warn('[Redis] Client not connected, will fallback to MongoDB');
      throw new Error('Redis client not connected');
    }

    // Determine suffix based on groupBy
    let suffix: string;
    if (groupBy === 1) {
      suffix = 'minutely';
    } else if (groupBy === 60) {
      suffix = 'hourly';
    } else if (groupBy === 1440) {
      suffix = 'daily';
    } else {
      // For custom intervals, fallback to minutely with aggregation
      suffix = 'minutely';
    }

    const key = groupHash
      ? `ts:events:${groupHash}:${suffix}`
      : projectId
      ? `ts:events:${projectId}:${suffix}`
      : `ts:events:${suffix}`;

    // Parse dates (support ISO string or Unix timestamp in seconds)
    const start = typeof startDate === 'string' && startDate.includes('-')
      ? new Date(startDate).getTime()
      : Number(startDate) * 1000;
    const end = typeof endDate === 'string' && endDate.includes('-')
      ? new Date(endDate).getTime()
      : Number(endDate) * 1000;

    const bucketMs = groupBy * 60 * 1000;

    let result: [string, string][] = [];
    try {
      // Use aggregation to sum values within each bucket
      // TS.INCRBY creates one point per time period with accumulated count
      result = (await this.redisClient.sendCommand([
        'TS.RANGE',
        key,
        start.toString(),
        end.toString(),
        'AGGREGATION',
        'sum',
        bucketMs.toString(),
      ])) as [string, string][] | [];
    } catch (err: any) {
      if (err.message.includes('TSDB: the key does not exist')) {
        console.warn(`[Redis] Key ${key} does not exist, returning zeroed data`);
        result = [];
      } else {
        throw err;
      }
    }

    // Transform data from Redis
    const dataPoints: { [ts: number]: number } = {};
    for (const [tsStr, valStr] of result) {
      const tsMs = Number(tsStr);
      dataPoints[tsMs] = Number(valStr) || 0;
    }

    // Fill missing intervals with zeros
    const filled: { timestamp: number; count: number }[] = [];
    let current = start;

    // Round current to the nearest bucket boundary
    current = Math.floor(current / bucketMs) * bucketMs;

    while (current <= end) {
      const count = dataPoints[current] || 0;
      filled.push({
        timestamp: Math.floor((current + timezoneOffset * 60 * 1000) / 1000),
        count,
      });
      current += bucketMs;
    }

    return filled.sort((a, b) => a.timestamp - b.timestamp);
  }
}