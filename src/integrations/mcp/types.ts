/**
 * Set of authorization data needed to verify that the original authorization request
 * was made by the same client making token request
 * 
 * Fields: 
 * - userId - Id of the user trying to authorize with MCP
 * - clientId - Id of the mcp-client requesting tokens
 * - redirectUri - URI that was used to request the authorization code
 * - codeChallenge - 
 */
export type AuthRequestData = {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
};

/**
 * 
 */
export type TokenData = {
  userId: string;
  clientId: string;
  tokenUse: "access" | "refresh";
  exp: number;
};

/**
 * Used by [In-memory store for MCP AuthRequest data](./store/memory.store.ts)
 * to track AuthRequset expiration
 */
export type MemoryAuthRequestData = AuthRequestData & {
  expiresAt: number
}

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

