import type { AuthRequestData } from './types';

/**
 * Interface for MCP AuthRequset data store implementations
 *
 * Defines contract for storing temporary data needed for MCP authentication flow:
 * - AuthRequest: maps authorization code to AuthRequest data
 */
export interface MCPAuthRequestStoreInterface {
  /**
   * Store type identifier
   * Used for logging and debugging purposes
   *
   * @example "redis" or "memory"
   */
  readonly type: string;

  /**
   * Save AuthRequest data
   *
   * @param code - Authorization code ()
   * @param data - AuthRequest data (userId, clientId, redirectUrl, codeChallenge)
   */
  saveAuthRequest(code: string, data: AuthRequestData): Promise<void>;

  /**
   * Get and consume AuthRequest data
   *
   * @param code - authorization code
   * @returns AuthRequset data or null if not found/expired
   */
  getAuthRequest(code: string): Promise<AuthRequestData | null>;
}
