import express from 'express';
import crypto from 'node:crypto';
import { createMCPStore } from '../store/storeFactory';
import { AuthenticationError } from 'apollo-server-express';
import { getUserJWTDataFromToken } from '../helpers/getUserIdFromToken';
import { generateMCPClientId } from '../helpers/generateMCPClientId';

import type { Request } from 'express';
import type { ContextFactories } from 'src/types/graphql';
import type { TokenRequest } from './types';

/**
 * Implements MCP Authorization Flow using OAuth 2.1
 *
 *
 * @param app
 * @param factories
 */
export function useMCPAuth(app: express.Application, factories: ContextFactories) {
  if (!process.env.API_URL) {
    throw new Error('API_URL environment variable must be set to generate redirect URI');
  }

  if (!process.env.GARAGE_URL) {
    throw new Error('GARAGE_URL environment variable must be set to generate authorization endpoint');
  }

  const store = createMCPStore();

  async function createTokenResponse(userId: string) {
    const tokensPair = await generateTokensPair(userId);

    const data = getUserJWTDataFromToken(tokensPair.accessToken, 'access');

    if (!data) {
      return;
    }

    return {
      access_token: tokensPair.accessToken,
      refresh_token: tokensPair.refreshToken,
      token_type: 'Bearer',
      expires_in: data.exp,
      scope: 'mcp:tools mcp:resources',
    };
  };

  async function generateTokensPair(userId: string) {
    const user = await factories.usersFactory.findById(userId);

    if (!user) {
      throw new AuthenticationError('Invalid userId');
    }

    return await user.generateTokensPair();
  };

  /**
   * Dynamic client registration
   */
  app.post('/register/integration/mcp', (req, res) => {
    res.status(201).json({
      client_id: generateMCPClientId(),
      client_name: req.body.client_name,
      redirect_uris: req.body.redirect_uris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: [ 'code' ],
      token_endpoint_auth_method: 'none',
    });
  });

  /**
   * Protected resource metadata
   */
  app.get(
    '/.well-known/oauth-protected-resource/integration/mcp',
    (_req, res) => {
      res.json({
        resource: `${process.env.API_URL}/integration/mcp`,
        authorization_servers: [
          `${process.env.API_URL}/integration/mcp`,
        ],
        scopes_supported: [
          'mcp:tools',
          'mcp:resources',
        ],
      });
    }
  );

  /**
   * OAuth server metadata
   */
  app.get(
    '/.well-known/oauth-authorization-server/integration/mcp',
    (_req, res) => {
      res.json({
        issuer: `${process.env.API_URL}/integration/mcp`,

        authorization_endpoint:
          `${process.env.GARAGE_URL}/concent`,

        token_endpoint:
          `${process.env.API_URL}/token/integration/mcp`,

        registration_endpoint:
         `${process.env.API_URL}/register/integration/mcp`,

        response_types_supported: [ 'code' ],

        grant_types_supported: [
          'authorization_code',
          'refresh_token',
        ],

        token_endpoint_auth_methods_supported: [
          'none',
        ],

        code_challenge_methods_supported: [
          'S256',
        ],
      });
    }
  );

  /**
   * Frontend callback
   */
  app.post('/concent/integration/mcp', async (req, res) => {
    const {
      client_id,
      redirect_uri,
      state,
      code_challenge,
    } = req.body;

    const header = req.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'unauthorized',
      });
    }

    const loginToken = header.slice(7);

    const user = getUserJWTDataFromToken(loginToken, 'access');

    if (!user) {
      return res.status(400).json({
        error: 'invalid_grant',
      });
    }

    const code = crypto
      .randomBytes(32)
      .toString('base64url');

    await store.saveAuthRequest(code, {
      userId: user.userId,
      clientId: client_id,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
    });

    const callback = new URL(redirect_uri);

    callback.searchParams.set('code', code);

    if (state) {
      callback.searchParams.set('state', state);
    }

    return res.json({
      redirect_uri: callback.toString(),
    });
  });

  /**
   * MCP client callback
   */
  app.post('/token/integration/mcp', async (req: Request<{}, {}, TokenRequest>, res) => {
    const { body } = req;

    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');

    if (body.grant_type === 'refresh_token') {
      const {
        refresh_token,
        client_id
      } = body;

      if (typeof refresh_token !== 'string' || !refresh_token ||
        typeof client_id !== 'string' || !client_id) {
        return res.status(400).json({ error: 'invalid_request' });
      }

      const data = getUserJWTDataFromToken(refresh_token, 'refresh');

      if (!data) {
        return res.status(400).json({ error: 'invalid_grant' });
      }

      const response = await createTokenResponse(data.userId);

      return res.json(response);
    }

    if (body.grant_type !== 'authorization_code') {
      return res.status(400).json({
        error: 'unsupported_grant_type',
      });
    }

    const {
      code,
      code_verifier,
      client_id,
      redirect_uri
    } = body;

    const auth = await store.getAuthRequest(code);

    if (!auth) {
      return res.status(400).json({
        error: 'invalid_grant',
      });
    }

    if (auth.clientId !== client_id) {
      return res.status(400).json({
        error: 'invalid_grant',
      });
    }

    if (auth.redirectUri !== redirect_uri) {
      return res.status(400).json({
        error: 'invalid_grant',
      });
    }

    /**
     * PKCE
     */
    const calculatedChallenge = crypto
      .createHash('sha256')
      .update(code_verifier)
      .digest('base64url');

    if (calculatedChallenge !== auth.codeChallenge) {
      return res.status(400).json({
        error: 'invalid_grant',
      });
    }

    const response = await createTokenResponse(auth.userId);

    return res.json(response);
  });
};
