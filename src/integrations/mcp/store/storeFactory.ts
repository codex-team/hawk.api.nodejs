import RedisHelper from '../../../redisHelper';
import { MemoryMCPAuthRequestStore } from './memory.store';
import { RedisMCPAuthRequestStore } from './redis.store';

import type { MCPAuthRequestStoreInterface } from './MCPAuthRequestStoreInterface';

/**
 * Create MCPAuthRequest data store instance based on configuration
 *
 * Store type is determined by MCP_AUTH_REQUEST_STORE_TYPE environment variable:
 * - 'redis' (default): Uses Redis store for multi-instance support
 * - 'memory': Uses in-memory store (single instance only)
 *
 * @returns MCPAuthRequest data store instance
 */
export function createMCPStore(): MCPAuthRequestStoreInterface {
  const storeType = (process.env.MCP_AUTH_REQUEST_STORE_TYPE || 'redis').toLowerCase();

  if (storeType === 'memory') {
    return new MemoryMCPAuthRequestStore();
  }

  if (storeType === 'redis') {
    const redisHelper = RedisHelper.getInstance();

    if (!redisHelper.isConnected()) {
      console.warn(
        '[MCP Store] Redis store requested but Redis is not connected. Falling back to memory store.'
      );

      return new MemoryMCPAuthRequestStore();
    }

    return new RedisMCPAuthRequestStore();
  }

  /**
   * Unknown store type, default to Redis
   */
  console.warn(
    `[MCP Store] Unknown store type "${storeType}". Defaulting to Redis.`
  );
  const redisHelper = RedisHelper.getInstance();

  if (redisHelper.isConnected()) {
    return new RedisMCPAuthRequestStore();
  }

  return new MemoryMCPAuthRequestStore();
}
