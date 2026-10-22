import type { AuthRequestData, MemoryAuthRequestData, MCPAuthRequestStoreInterface } from "../types";

/**
 * In-memory store for MCP AuthRequest data
 * 
 * Stores temporary data needed for MCP authentication flow:
 * - AuthRequest maps authorization code to AuthRequest data
 * 
 * Note: This implementation is not suitable for multi-instance deployments.
 * Use Redis store for production environments with multiple API instances.
 */
export class MemoryMCPAuthRequestStore implements MCPAuthRequestStoreInterface {
  /**
   * Store type identifier
   */
  public readonly type = 'memory';

  private AuthState: Map<string, MemoryAuthRequestData> = new Map();

  /**
   * Time-to-live for stored data (5 minutes)
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
   * Save AuthRequest data
   * 
   * @param code - Authorization code ()
   * @param data - AuthRequest data (userId, clientId, redirectUrl, codeChallenge)
   */
  public async saveAuthRequest(code: string, data: MemoryAuthRequestData): Promise<void> {
    this.AuthState.set(code,
      {
        ...data,
        expiresAt: Date.now() + this.TTL
      }
    );
  }

  /**
   * Get AuthRequest data
   * 
   * @param code - authorizaton code
   * @returns authRequest data or null if not found/expired
   */
  public async getAuthRequest(code: string): Promise<AuthRequestData | null> {
    const data = this.AuthState.get(code);

    if (!data) {
      return null;
    }

    if (Date.now() > data.expiresAt) {
      this.AuthState.delete(code);
    }

    this.AuthState.delete(code);

    const { expiresAt, ...authRequestData } = data;

    return authRequestData;
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);

    this.cleanupTimer.unref();
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();

    for (const [key, value] of this.AuthState) {
      if (now > value.expiresAt) {
        this.AuthState.delete(key);
      }
    }
  }

}
