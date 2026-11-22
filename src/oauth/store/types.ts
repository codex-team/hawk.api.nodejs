import type { MemoryOAuthRequestStore } from './memory.store';

/**
 * Authorization data needed to verify that the original authorization request
 * was made by the same client making token request
 */
export type OAuthRequestData = {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
};

/**
 * Used by {@link MemoryOAuthRequestStore}
 * to track AuthRequest expiration
 */
export type MemoryAuthRequestData = OAuthRequestData & {
  expiresAt: number;
}
