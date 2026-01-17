import { RedisClientType } from 'redis';
import RedisHelper from '../../../redisHelper';
import { SamlStateStoreInterface } from './SamlStateStoreInterface';

/**
 * Redis-based store for SAML state
 *
 * Stores temporary data needed for SAML authentication flow in Redis:
 * - RelayState: maps state ID to return URL and workspace ID
 * - AuthnRequests: maps request ID to workspace ID for InResponseTo validation
 *
 * This implementation is suitable for multi-instance deployments as it uses
 * Redis as the shared state store. TTLs are handled by Redis automatically.
 */
export class RedisSamlStateStore implements SamlStateStoreInterface {
  /**
   * Store type identifier
   */
  public readonly type = 'redis';

  /**
   * Redis helper instance
   */
  private redisHelper: RedisHelper;

  /**
   * Time-to-live for stored state in seconds (5 minutes)
   */
  private readonly TTL_SECONDS = 5 * 60;

  /**
   * Prefix for RelayState keys in Redis
   */
  private readonly RELAY_STATE_PREFIX = 'saml:relayState:';

  /**
   * Prefix for AuthnRequest keys in Redis
   */
  private readonly AUTHN_REQUEST_PREFIX = 'saml:authnRequest:';

  /**
   * Store constructor
   *
   * @param redisHelper - Redis helper instance (defaults to singleton)
   */
  constructor(redisHelper?: RedisHelper) {
    this.redisHelper = redisHelper || RedisHelper.getInstance();
  }

  /**
   * Save RelayState data
   *
   * @param stateId - unique state identifier (usually UUID)
   * @param data - relay state data (returnUrl, workspaceId)
   */
  public async saveRelayState(stateId: string, data: { returnUrl: string; workspaceId: string }): Promise<void> {
    const client = this.getClient();
    const key = `${this.RELAY_STATE_PREFIX}${stateId}`;
    const value = JSON.stringify(data);

    await client.setEx(key, this.TTL_SECONDS, value);
  }

  /**
   * Get and consume RelayState data
   *
   * @param stateId - state identifier
   * @returns relay state data or null if not found/expired
   */
  public async getRelayState(stateId: string): Promise<{ returnUrl: string; workspaceId: string } | null> {
    const client = this.getClient();
    const key = `${this.RELAY_STATE_PREFIX}${stateId}`;

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
      return JSON.parse(value) as { returnUrl: string; workspaceId: string };
    } catch (error) {
      console.error('[Redis SAML Store] Failed to parse RelayState:', error);

      return null;
    }
  }

  /**
   * Save AuthnRequest for InResponseTo validation
   *
   * @param requestId - SAML AuthnRequest ID
   * @param workspaceId - workspace ID
   */
  public async saveAuthnRequest(requestId: string, workspaceId: string): Promise<void> {
    const client = this.getClient();
    const key = `${this.AUTHN_REQUEST_PREFIX}${requestId}`;

    /**
     * Store workspaceId as value
     */
    await client.setEx(key, this.TTL_SECONDS, workspaceId);
  }

  /**
   * Validate and consume AuthnRequest
   *
   * @param requestId - SAML AuthnRequest ID (from InResponseTo)
   * @param workspaceId - expected workspace ID
   * @returns true if request is valid and matches workspace
   */
  public async validateAndConsumeAuthnRequest(requestId: string, workspaceId: string): Promise<boolean> {
    const client = this.getClient();
    const key = `${this.AUTHN_REQUEST_PREFIX}${requestId}`;

    /**
     * Get and delete atomically to prevent replay attacks
     * This ensures the request can only be validated once
     * Using MULTI/EXEC for atomic operation (compatible with Redis 5.0+)
     */
    const results = await client
      .multi()
      .get(key)
      .del(key)
      .exec();

    if (!results || results.length < 2) {
      return false;
    }

    const storedWorkspaceId = results[0] as string | null;

    if (!storedWorkspaceId) {
      return false;
    }

    /**
     * Check workspace match
     */
    return storedWorkspaceId === workspaceId;
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
