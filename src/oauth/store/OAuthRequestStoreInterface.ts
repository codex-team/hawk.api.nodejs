import type { OAuthRequestData } from './types';

/**
 * Interface for OAuthRequset data store implementations
 *
 * Defines contract for storing temporary data needed for OAuth authentication flow:
 * - AuthRequest: maps authorization code to AuthRequest data
 */
export interface OAuthRequestStoreInterface {
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
  saveOAuthRequest(code: string, data: OAuthRequestData): Promise<void>;

  /**
   * Get and consume AuthRequest data
   *
   * @param code - authorization code
   * @returns AuthRequset data or null if not found/expired
   */
  getOAuthRequest(code: string): Promise<OAuthRequestData | null>;
}
