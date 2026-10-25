import RedisHelper from '../../../redisHelper';

import type { MCPAuthRequestStoreInterface } from './MCPAuthRequestStoreInterface';
import type { AuthRequestData } from './types';
import type { RedisClientType } from 'redis';

/**
 * Redis-based store for MCP AuthRequest data
 *
 * Stores temporary data needed for MCP authentication flow:
 * - AuthRequest maps authorization code to AuthRequest data
 *
 * This implementation is suitable for multi-instance deployments as it uses
 * Redis as the shared state store. TTLs are handled by Redis automatically.
 */
export class RedisMCPAuthRequestStore implements MCPAuthRequestStoreInterface {
  /**
   * Store type identifier
   */
  public readonly type = 'redis';

  /**
   * Redis helper instance
   */
  private redisHelper: RedisHelper;

  /**
   * Time-to-live for stored data in seconds (5 minutes)
   */
  private readonly TTL_SECONDS = 5 * 60;

  /**
   * Prefix for AuthRequest keys in Redis
   */
  private readonly MCP_AUTH_REQUEST_PREFIX = 'mcp:auth';

  constructor(redisHelper?: RedisHelper) {
    this.redisHelper = redisHelper || RedisHelper.getInstance();
  }

  /**
   * Save AuthRequest data
   *
   * @param code - authorization code
   * @param data - AuthRequest data (userId, clientId, redirectUrl, codeChallenge)
   */
  public async saveAuthRequest(code: string, data: AuthRequestData): Promise<void> {
    const client = this.getClient();
    const key = `${this.MCP_AUTH_REQUEST_PREFIX}${code}`;
    const value = JSON.stringify(data);

    await client.setEx(key, this.TTL_SECONDS, value);
  }

  /**
   * Get and consume AuthRequest data
   *
   * @param code - authorization code
   * @returns AuthRequset data or null if not found/expired
   */
  public async getAuthRequest(code: string): Promise<AuthRequestData | null> {
    const client = this.getClient();
    const key = `${this.MCP_AUTH_REQUEST_PREFIX}${code}`;

    /**
     * Get and delete atomically to prevent race conditions
     * This ensures the state can only be consumed once
     * Using MULTI/EXEC for atomic operation (compatible with Redis 5.0+)
     */
    const result = await client
      .multi()
      .get(key)
      .del(key)
      .exec();

    if (!result || result.length < 2) {
      return null;
    }

    const value = result[0] as string | null;

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as AuthRequestData;
    } catch (error) {
      console.error('[Redis MCP Store] Failed to parse AuthCode', error);

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
