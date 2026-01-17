import { AuthnRequestState, RelayStateData } from '../types';
import { SamlStateStoreInterface } from './SamlStateStoreInterface';

/**
 * In-memory store for SAML state
 *
 * Stores temporary data needed for SAML authentication flow:
 * - RelayState: maps state ID to return URL and workspace ID
 * - AuthnRequests: maps request ID to workspace ID for InResponseTo validation
 *
 * Note: This implementation is not suitable for multi-instance deployments.
 * Use Redis store for production environments with multiple API instances.
 */
export class MemorySamlStateStore implements SamlStateStoreInterface {
  /**
   * Store type identifier
   */
  public readonly type = 'memory';

  private relayStates: Map<string, RelayStateData> = new Map();
  private authnRequests: Map<string, AuthnRequestState> = new Map();

  /**
   * Time-to-live for stored state (5 minutes)
   */
  private readonly TTL = 5 * 60 * 1000;

  /**
   * Interval for cleanup of expired entries (1 minute)
   */
  private readonly CLEANUP_INTERVAL = 60 * 1000;

  /**
   * Cleanup timer reference
   */
  private cleanupTimer: NodeJS.Timeout | null = null;

  /**
   * Store constructor
   */
  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Save RelayState data
   *
   * @param stateId - unique state identifier (usually UUID)
   * @param data - relay state data (returnUrl, workspaceId)
   */
  public async saveRelayState(stateId: string, data: { returnUrl: string; workspaceId: string }): Promise<void> {
    this.relayStates.set(stateId, {
      ...data,
      expiresAt: Date.now() + this.TTL,
    });
  }

  /**
   * Get and consume RelayState data
   *
   * @param stateId - state identifier
   * @returns relay state data or null if not found/expired
   */
  public async getRelayState(stateId: string): Promise<{ returnUrl: string; workspaceId: string } | null> {
    const state = this.relayStates.get(stateId);

    if (!state) {
      return null;
    }

    /**
     * Check expiration
     */
    if (Date.now() > state.expiresAt) {
      this.relayStates.delete(stateId);

      return null;
    }

    /**
     * Consume (delete after use to prevent replay)
     */
    this.relayStates.delete(stateId);

    return {
      returnUrl: state.returnUrl,
      workspaceId: state.workspaceId,
    };
  }

  /**
   * Save AuthnRequest for InResponseTo validation
   *
   * @param requestId - SAML AuthnRequest ID
   * @param workspaceId - workspace ID
   */
  public async saveAuthnRequest(requestId: string, workspaceId: string): Promise<void> {
    this.authnRequests.set(requestId, {
      workspaceId,
      expiresAt: Date.now() + this.TTL,
    });
  }

  /**
   * Validate and consume AuthnRequest
   *
   * @param requestId - SAML AuthnRequest ID (from InResponseTo)
   * @param workspaceId - expected workspace ID
   * @returns true if request is valid and matches workspace
   */
  public async validateAndConsumeAuthnRequest(requestId: string, workspaceId: string): Promise<boolean> {
    const request = this.authnRequests.get(requestId);

    if (!request) {
      return false;
    }

    /**
     * Check expiration
     */
    if (Date.now() > request.expiresAt) {
      this.authnRequests.delete(requestId);

      return false;
    }

    /**
     * Check workspace match
     */
    if (request.workspaceId !== workspaceId) {
      return false;
    }

    /**
     * Consume (delete after use to prevent replay attacks)
     */
    this.authnRequests.delete(requestId);

    return true;
  }

  /**
   * Stop cleanup timer (for testing)
   */
  public stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Clear all stored state (for testing)
   */
  public clear(): void {
    this.relayStates.clear();
    this.authnRequests.clear();
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanupTimer(): void {
    /**
     * Don't start timer in test environment
     */
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);

    /**
     * Don't prevent process from exiting
     */
    this.cleanupTimer.unref();
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();

    for (const [key, value] of this.relayStates) {
      if (now > value.expiresAt) {
        this.relayStates.delete(key);
      }
    }

    for (const [key, value] of this.authnRequests) {
      if (now > value.expiresAt) {
        this.authnRequests.delete(key);
      }
    }
  }
}
