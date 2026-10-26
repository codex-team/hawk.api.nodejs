/* eslint-disable @typescript-eslint/camelcase, camelcase */
import express from 'express';
import crypto from 'node:crypto';
import { createMCPStore } from '../store/storeFactory';
import { AuthenticationError } from 'apollo-server-express';
import { getUserJWTDataFromToken } from '../helpers/getUserIdFromToken';
import { generateMCPClientId } from '../helpers/generateMCPClientId';

import type { Request, Response } from 'express';
import type { TokensPair } from '@hawk.so/types';
import type { ContextFactories } from 'src/types/graphql';
import type {
  AuthorizationServerMetadataResponse,
  ClientInformationResponse,
  ProtectedResourceMetadataResponse,
  TokenRequest,
  TokenResponse
} from './types';

/**
 * Implements MCP Authorization Flow following
 * {@link https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-16 | OAuth 2.1}
 * and
 * {@link https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/authorization | Authorization in MCP}
 *
 * Flow:
 * 1. The client discovers the OAuth metadata and authorization endpoints.
 * 2. The user signs in and supplies an authorization header.
 * 3. The server generates an authorization code and stores the pending request data.
 * 4. The client exchanges the code together with the PKCE verifier for a token pair.
 * 5. Refresh tokens can be exchanged for a new access and refresh token pair.
 *
 * @param app - Express application instance
 * @param factories - context factories for database access
 */
export function useMCPAuth(app: express.Application, factories: ContextFactories) {
  const store = createMCPStore();

  /**
   * Generates new {@link TokensPair}
   *
   * @param userId - user ID
   * @returns TokensPair - newly generated access and refresh tokens
   */
  async function generateTokensPair(userId: string) {
    const user = await factories.usersFactory.findById(userId);

    if (!user) {
      throw new AuthenticationError('Invalid userId');
    }

    return user.generateTokensPair();
  };

  /**
   * Creates {@link TokenResponse}
   *
   * @param userId - user ID
   * @returns TokenResponse or null
   */
  async function createTokenResponse(userId: string): Promise<TokenResponse | null> {
    const tokensPair = await generateTokensPair(userId);

    const data = getUserJWTDataFromToken(tokensPair.accessToken, 'access');

    if (!data) {
      return null;
    }

    return {
      access_token: tokensPair.accessToken,
      refresh_token: tokensPair.refreshToken,
      token_type: 'Bearer',
      expires_in: data.exp,
      scope: 'mcp:tools mcp:resources',
    };
  };

  /**
   * Protected Resource Metadata (PRM) discovery
   *
   * MCP client retrieves metadata the authorization server,
   * supported scopes, and other resource information
   */
  app.get(
    '/.well-known/oauth-protected-resource/integration/mcp',
    (_req, res: Response<ProtectedResourceMetadataResponse>) => {
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
   * Authorization Server Discovery
   *
   * MCP client retrieves another set of metadata properties
   * that will allow it to know the endpoints it needs to complete the authorization flow
   */
  app.get(
    '/.well-known/oauth-authorization-server/integration/mcp',
    (_req, res: Response<AuthorizationServerMetadataResponse>) => {
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
   * Dynamic Client Registration (DCR)
   *
   * Generates random clientId
   *
   * Typically used to register MCP with the authorization server dynamically.
   * Currently we do not have any real authorization server, but this endpoint is still
   * implemented in order not to bug the user with manual clientId creation in some IDEs (VSCode)
   */
  app.post('/register/integration/mcp', (req, res: Response<ClientInformationResponse>) => {
    res.status(201).json({
      client_id: generateMCPClientId(),
      client_name: req.body.client_name,
      redirect_uris: req.body.redirect_uris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: [ 'code' ],
    });
  });

  /**
   * Authorization Endpoint callback
   * https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-16#name-authorization-endpoint
   *
   * Authenticates the resource owner and establishes
   * whether the resource owner grants or denies the client's access request
   *
   * Assuming the resource owner grants access, the authorization server redirects
   * the user agent back to the client using the redirect URI provided earlier
   * (in the request or during client registration).
   * The redirect URI includes an authorization code and any local state
   * provided by the client earlier
   */
  app.post('/concent/integration/mcp', async (req, res) => {
    const {
      client_id,
      redirect_uri,
      state,
      code_challenge,
    } = req.body;

    const header = req.headers.authorization;

    if (typeof header !== 'string') {
      return res.status(400).json({
        error: 'invalid_grant',
      });
    }

    const loginToken = header.slice(7);

    const user = getUserJWTDataFromToken(loginToken, 'access');

    if (!user) {
      return res.status(400).json({
        error: 'invalid_grant',
      });
    }

    /**
     * Authorization code generation
     */
    const code = crypto
      .randomBytes(32)
      .toString('base64url');

    /**
     * Save AuthRequest data to retrieve data on the next step
     */
    await store.saveAuthRequest(code, {
      userId: user.userId,
      clientId: client_id,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
    });

    /**
     * Add parameters to redirect_uri
     */
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
   * Token Endpoint
   * https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-16#name-token-endpoint
   *
   * Token endpoint is used by the MCP client to exchange the authorization code to access token or
   * generate new {@link TokensPair} by refresh token
   *
   * ON 'authorization_code' GRANT TYPE:
   * - Validates the authorization code, validates the code verifier, and ensures that
   *   the redirect URI received matches the URI used to redirect the user agent to the client in previous step.
   *   If valid, the authorization server responds back with an access token and a refresh token
   *
   * ON 'refresh_token' GRANT TYPE:
   *  - Validates refresh token. If valid, the authorization server responds back with an access token and a refresh token
   */
  app.post('/token/integration/mcp', async (req: Request<{}, {}, TokenRequest>, res) => {
    const { body } = req;

    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');

    if (body.grant_type === 'refresh_token') {
      const {
        refresh_token,
        client_id,
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

      if (!response) {
        console.warn(`[MCP Auth] refresh_token was successfully verified, but ${data.userId} could not be found`);

        return res.status(400).json({ error: 'invalid_grant' });
      }

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
      redirect_uri,
    } = body;

    /**
     * Retrieve AuthRequest data from the store
     */
    const data = await store.getAuthRequest(code);

    if (!data) {
      return res.status(400).json({
        error: 'invalid_grant',
      });
    }

    if (data.clientId !== client_id) {
      return res.status(400).json({
        error: 'invalid_grant',
      });
    }

    if (data.redirectUri !== redirect_uri) {
      return res.status(400).json({
        error: 'invalid_grant',
      });
    }

    /**
     * Validate codeChallenge
     */
    const calculatedChallenge = crypto
      .createHash('sha256')
      .update(code_verifier)
      .digest('base64url');

    if (calculatedChallenge !== data.codeChallenge) {
      return res.status(400).json({
        error: 'invalid_grant',
      });
    }

    const response = await createTokenResponse(data.userId);

    if (!response) {
      console.warn(`[MCP Auth] refresh_token was successfully verified, but ${data.userId} could not be found`);

      return res.status(400).json({ error: 'invalid_grant' });
    }

    return res.json(response);
  });
};
