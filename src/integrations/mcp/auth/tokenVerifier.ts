import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';
import { getUserJWTDataFromToken } from '../helpers/getUserIdFromToken';
import { generateMCPClientId } from '../helpers/generateMCPClientId';

import type { OAuthTokenVerifier } from '@modelcontextprotocol/server';

/**
 * 
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
      scopes: ["mcp:tools", "mcp:resources"],
      expiresAt: data.exp
    };
  },
};