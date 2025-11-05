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
    groupingBy: 'hours' | 'days',
    rangeValue: number,
    timezoneOffset = 0,
    projectId = '',
    groupHash = ''
  ): Promise<{ timestamp: number; count: number }[]> {
    if (!this.redisClient.isOpen) {
      throw new Error('Redis client not connected');
    }
  
    const suffix = groupingBy === 'hours' ? 'hourly' : 'daily';
    const key = groupHash
      ? `ts:events:${groupHash}:${suffix}`
      : projectId
      ? `ts:events:${projectId}:${suffix}`
      : `ts:events:${suffix}`;
    
      const now = Date.now();
    
      // определяем начало выборки
      const fromDate = new Date(now);
      if (groupingBy === 'hours') {
        fromDate.setMinutes(0, 0, 0);
      } else {
        fromDate.setHours(0, 0, 0, 0);
      }
      fromDate.setMilliseconds(fromDate.getMilliseconds() - (groupingBy === 'hours' ? rangeValue * 60 * 60 * 1000 : rangeValue * 24 * 60 * 60 * 1000));
      const from = fromDate.getTime();
    
      let result: [string, string][] = [];
      try {
        result = (await this.redisClient.sendCommand([
          'TS.RANGE',
          key,
          from.toString(),
          now.toString(),
        ])) as [string, string][] | [];
      } catch (err: any) {
        if (err.message.includes('TSDB: the key does not exist')) {
          console.warn(`[Redis] Key ${key} does not exist, returning zeroed data`);
          result = [];
        } else {
          throw err;
        }
      }
    
      // агрегируем события по интервалу
      const dataPoints: { [ts: number]: number } = {};
      for (const [tsStr] of result) {
        const tsMs = Number(tsStr);
        const date = new Date(tsMs);
    
        let intervalStart: number;
        if (groupingBy === 'hours') {
          date.setMinutes(0, 0, 0);
          intervalStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours());
        } else {
          date.setHours(0, 0, 0, 0);
          intervalStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
        }
    
        const intervalWithOffset = intervalStart + timezoneOffset * 60 * 1000;
        dataPoints[intervalWithOffset] = (dataPoints[intervalWithOffset] || 0) + 1;
      }
    
      // заполняем пропущенные интервалы нулями
      const filled: { timestamp: number; count: number }[] = [];
      const nowDate = new Date(now);
    
      for (let i = 0; i < rangeValue; i++) {
        const date = new Date(nowDate);
    
        if (groupingBy === 'hours') {
          date.setHours(date.getHours() - i, 0, 0, 0);
          var intervalStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours());
        } else {
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);
          var intervalStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
        }
    
        const intervalWithOffset = intervalStart + timezoneOffset * 60 * 1000;
        filled.push({
          timestamp: Math.floor(intervalWithOffset / 1000),
          count: dataPoints[intervalWithOffset] || 0,
        });
      }
    
      return filled.sort((a, b) => a.timestamp - b.timestamp);
  }
}