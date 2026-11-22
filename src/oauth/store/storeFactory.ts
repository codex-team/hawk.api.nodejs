import RedisHelper from '../../redisHelper';
import { MemoryOAuthRequestStore } from './memory.store';
import { RedisOAuthRequestStore } from './redis.store';

import type { OAuthRequestStoreInterface } from './OAuthRequestStoreInterface';

/**
 * Create OAuthRequest data store instance based on configuration
 *
 * Store type is determined by OAUTH_REQUEST_STORE_TYPE environment variable:
 * - 'redis' (default): Uses Redis store for multi-instance support
 * - 'memory': Uses in-memory store (single instance only)
 *
 * @returns OAuthRequest data store instance
 */
export function createOAuthStore(): OAuthRequestStoreInterface {
  const storeType = (process.env.OAUTH_REQUEST_STORE_TYPE || 'redis').toLowerCase();

  if (storeType === 'memory') {
    return new MemoryOAuthRequestStore();
  }

  if (storeType === 'redis') {
    const redisHelper = RedisHelper.getInstance();

    if (!redisHelper.isConnected()) {
      console.warn(
        '[OAuth Store] Redis store requested but Redis is not connected. Falling back to memory store.'
      );

      return new MemoryOAuthRequestStore();
    }

    return new RedisOAuthRequestStore();
  }

  /**
   * Unknown store type, default to Redis
   */
  console.warn(
    `[OAuth Store] Unknown store type "${storeType}". Defaulting to Redis.`
  );
  const redisHelper = RedisHelper.getInstance();

  if (redisHelper.isConnected()) {
    return new RedisOAuthRequestStore();
  }

  return new MemoryOAuthRequestStore();
}
