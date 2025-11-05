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
   * Redis client instance
   */
  private readonly redisClient!: RedisClientType;

  /**
   * Constructor
   * Initializes the Redis client and sets up error handling
   */
  constructor() {
    try {
      this.redisClient = createClient({ url: process.env.REDIS_URL });

      this.redisClient.on('error', (error) => {
        console.error('[Redis] Client error:', error);
        if (error) {
          HawkCatcher.send(error);
        }
      });
    } catch (error) {
      console.error('[Redis] Error creating client:', error);
    }
  }

  /**
   * Connect to Redis
   */
  public async initialize(): Promise<void> {
    try {
      await this.redisClient.connect();
      console.log('[Redis] Connected successfully');
    } catch (error) {
      console.error('[Redis] Connection failed:', error);
      HawkCatcher.send(error as Error);
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
  
  public async getChartDataFromRedis(
    startDate: string,
    endDate: string,
    groupBy: number, // minutes: 1=minute, 60=hour, 1440=day
    timezoneOffset = 0,
    projectId = '',
    groupHash = ''
  ): Promise<{ timestamp: number; count: number }[]> {
    if (!this.redisClient.isOpen) {
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
      // Use aggregation to sum events within each bucket
      // Since we now use TS.ADD (not TS.INCRBY), each sample is 1, so SUM gives us count
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