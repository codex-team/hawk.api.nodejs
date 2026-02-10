import { RedisClientType } from 'redis';
import RedisHelper from '../../../redisHelper';
import { InstallStateStoreInterface } from './InstallStateStoreInterface';

/**
 * Redis-based store for GitHub App installation state
 *
 * Stores temporary data needed for GitHub App installation flow in Redis:
 * - Installation state: maps state ID to projectId, userId, and timestamp
 *
 * This implementation is suitable for multi-instance deployments as it uses
 * Redis as the shared state store. TTLs are handled by Redis automatically.
 */
export class RedisInstallStateStore implements InstallStateStoreInterface {
  /**
   * Store type identifier
   */
  public readonly type = 'redis';

  /**
   * Redis helper instance
   */
  private redisHelper: RedisHelper;

  /**
   * Time-to-live for stored state in seconds (15 minutes)
   */
  private readonly TTL_SECONDS = 15 * 60;

  /**
   * Prefix for installation state keys in Redis
   */
  private readonly STATE_PREFIX = 'github-app-installation:state:';

  /**
   * Store constructor
   *
   * @param redisHelper - Redis helper instance (defaults to singleton)
   */
  constructor(redisHelper?: RedisHelper) {
    this.redisHelper = redisHelper || RedisHelper.getInstance();
  }

  /**
   * Save installation state data
   *
   * @param stateId - unique state identifier (usually UUID)
   * @param data - installation state data (projectId, userId, timestamp)
   */
  public async saveState(
    stateId: string,
    data: { projectId: string; userId: string; timestamp: number }
  ): Promise<void> {
    const client = this.getClient();
    const key = `${this.STATE_PREFIX}${stateId}`;
    const value = JSON.stringify(data);

    await client.setEx(key, this.TTL_SECONDS, value);
  }

  /**
   * Get and consume installation state data
   *
   * @param stateId - state identifier
   * @returns installation state data or null if not found/expired
   */
  public async getState(stateId: string): Promise<{ projectId: string; userId: string; timestamp: number } | null> {
    const client = this.getClient();
    const key = `${this.STATE_PREFIX}${stateId}`;

    /**
     * Get and delete atomically to prevent race conditions
     * This ensures the state can only be consumed once
     * Using MULTI/EXEC for atomic operation (compatible with Redis 5.0+)
     */
    const results = await client
      .multi()
      .get(key)
      .del(key)
      .exec();

    if (!results || results.length < 2) {
      return null;
    }

    const value = results[0] as string | null;

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as { projectId: string; userId: string; timestamp: number };
    } catch (error) {
      console.error('[Redis GitHub Install Store] Failed to parse state:', error);

      return null;
    }
  }

  /**
   * Get Redis client
   *
   * @returns Redis client instance
   * @throws Error if Redis client is not available
   */
  private getClient(): RedisClientType {
    const client = this.redisHelper.getClient();

    if (!client) {
      throw new Error('Redis client is not available. Make sure Redis is initialized.');
    }

    if (!client.isOpen) {
      throw new Error('Redis client is not connected. Make sure Redis connection is established.');
    }

    return client;
  }
}
