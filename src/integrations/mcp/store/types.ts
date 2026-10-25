/**
 * Authorization data needed to verify that the original authorization request
 * was made by the same client making token request
 */
export type AuthRequestData = {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
};

/**
 * Used by [In-memory store for MCP AuthRequest data](./memory.store.ts)
 * to track AuthRequest expiration 
 */
export type MemoryAuthRequestData = AuthRequestData & {
  expiresAt: number;
}
