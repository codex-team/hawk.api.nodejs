import express from 'express';
import { ContextFactories } from '../../types/graphql';
import { createMCPHandler } from './mcp';
import { requireBearerAuth } from '@modelcontextprotocol/express';
import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';
import { verifyJWT } from '../../utils/verifyJWT';

import type { Response } from 'express';
import type { OAuthJWTData, ProtectedResourceMetadataResponse } from '../../oauth/types';
import type { AuthInfo, OAuthTokenVerifier } from '@modelcontextprotocol/server';

/**
 * Appends MCP route to Express App
 *
 * @param app - Express application instance
 * @param factories - context factories for database access
 */
export function appendMCPRoutes(app: express.Application, factories: ContextFactories): void {
  const handler = createMCPHandler(factories);

  /**
   * Used by {@link authMiddleware}. Checks access token validity
   *
   * On SUCCESS returns the resulting {@link AuthInfo}, which the serving entry surfaces to MCP request handlers
   *
   * On ERROR throws OAuthError
   */
  const tokenVerifier: OAuthTokenVerifier = {
    verifyAccessToken: async (token: string) => {
      const data = verifyJWT<OAuthJWTData>(token, 'access');

      if (!data) {
        throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid or expired access token');
      }

      const success = await factories.oauthFactory.trackUse(data.jti);

      if (!success) {
        throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid or expired access token');
      }

      return {
        token,
        clientId: data.clientId,
        scopes: ['mcp:tools', 'mcp:resources'],
        expiresAt: data.exp,
        extra: { userId: data.userId },
      };
    },
  };

  /**
   * Express middleware that requires a valid Bearer token in the Authorization header
   *
   * On failure the middleware sends a JSON OAuth error body and a WWW-Authenticate: Bearer …
   * challenge that includes the configured resource_metadata URL
   * so clients can discover the Authorization Server
   */
  const authMiddleware = requireBearerAuth({
    verifier: tokenVerifier,
    resourceMetadataUrl:
      `${process.env.API_URL}/.well-known/oauth-protected-resource/mcp`,
  });

  /**
   * Protected Resource Metadata (PRM) discovery
   *
   * Client retrieves metadata the authorization server,
   * supported scopes, and other resource information
   */
  app.get(
    '/.well-known/oauth-protected-resource/mcp',
    (_req, res: Response<ProtectedResourceMetadataResponse>) => {
      res.json({
        resource: `${process.env.API_URL}/integration/mcp`,
        authorization_servers: [
          `${process.env.API_URL}`,
        ],
        scopes_supported: [
          'mcp:tools',
          'mcp:resources',
        ],
      });
    }
  );

  app.use('/integration/mcp', authMiddleware, (req, res) => handler(req, res, req.body));
}
