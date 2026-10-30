import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';
import { getUserJWTDataFromToken } from '../helpers/getUserIdFromToken';
import { generateMCPClientId } from '../helpers/generateMCPClientId';

import type { authMiddleware } from './authMiddleware';
import type { AuthInfo, OAuthTokenVerifier } from '@modelcontextprotocol/server';

/**
 * Used by {@link authMiddleware}. Checks access token validity
 *
 * On SUCCESS returns the resulting {@link AuthInfo}, which the serving entry surfaces to MCP request handlers
 *
 * On ERROR throws OAuthError
 */
export const tokenVerifier: OAuthTokenVerifier = {
  verifyAccessToken: async (token: string) => {
    const data = getUserJWTDataFromToken(token, 'access');

    if (!data) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid or expired access token');
    }

    return {
      token,
      clientId: generateMCPClientId(),
      scopes: ['mcp:tools', 'mcp:resources'],
      expiresAt: data.exp,
    };
  },
};