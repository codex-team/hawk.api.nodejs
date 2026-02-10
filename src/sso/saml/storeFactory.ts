import RedisHelper from '../../redisHelper';
import { MemorySamlStateStore } from './store/memory.store';
import { RedisSamlStateStore } from './store/redis.store';
import { SamlStateStoreInterface } from './store/SamlStateStoreInterface';

/**
 * Create SAML state store instance based on configuration
 *
 * Store type is determined by SAML_STORE_TYPE environment variable:
 * - 'redis' (default): Uses Redis store for multi-instance support
 * - 'memory': Uses in-memory store (single instance only)
 *
 * @returns SAML state store instance
 */
export function createSamlStateStore(): SamlStateStoreInterface {
  const storeType = (process.env.SAML_STORE_TYPE || 'redis').toLowerCase();

  if (storeType === 'memory') {
    return new MemorySamlStateStore();
  }

  if (storeType === 'redis') {
    const redisHelper = RedisHelper.getInstance();

    if (!redisHelper.isConnected()) {
      console.warn(
        '[SAML Store] Redis store requested but Redis is not connected. Falling back to memory store.'
      );

      return new MemorySamlStateStore();
    }

    return new RedisSamlStateStore(redisHelper);
  }

  /**
   * Unknown store type, default to Redis
   */
  console.warn(
    `[SAML Store] Unknown store type "${storeType}". Defaulting to Redis.`
  );
  const redisHelper = RedisHelper.getInstance();

  if (redisHelper.isConnected()) {
    return new RedisSamlStateStore(redisHelper);
  }

  return new MemorySamlStateStore();
}
