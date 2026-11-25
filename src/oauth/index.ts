/* eslint-disable @typescript-eslint/camelcase, camelcase */
import express from 'express';
import crypto from 'node:crypto';
import { verifyJWT } from '../utils/verifyJWT';
import { createOAuthStore } from './store/storeFactory';
import { generateOAuthClientId } from './helpers/generateOAuthClientId';
import { OAuthErrorCode, OAuthGrantType } from '@hawk.so/types';
import { isLoopback } from './helpers/isLoopback';

import type { Request, Response } from 'express';
import type { OAuthTokenRequest, TokenResponse, TokensPair } from '@hawk.so/types';
import type { ContextFactories } from '../types/graphql';
import type {
  AuthorizationServerMetadataResponse,
  ClientInformationResponse,
  OAuthJWTData
} from './types';

/**
 * Redirect uris that are allowed to be used in OAuth Flow.
 * Prevents access to recources from unknown third-party applications.
 */
const ALLOWED_REDIRECT_URIS = new Set<string>();

/**
 * Implements OAuth Authorization Flow following
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
export function appendOAuthRoutes(app: express.Application, factories: ContextFactories) {
  const store = createOAuthStore();

  /**
   * Generates new {@link TokensPair}
   *
   * @param userId user ID
   * @param jti json web token identifier
   * @returns TokensPair - newly generated access and refresh tokens
   */
  async function generateTokensPair(oauthId: string) {
    const oauthClient = await factories.oauthFactory.findById(oauthId);

    if (!oauthClient) {
      return null;
    }

    return oauthClient.generateTokensPair();
  };

  /**
   * Creates {@link TokenResponse}
   *
   * @param userId - user ID
   * @returns TokenResponse or null
   */
  async function createTokenResponse(oauthId: string): Promise<TokenResponse | null> {
    const tokensPair = await generateTokensPair(oauthId);

    if (!tokensPair) {
      return null;
    }

    const data = verifyJWT<OAuthJWTData>(tokensPair.accessToken, 'access');

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
   * Authorization Server Discovery
   *
   * Client retrieves another set of metadata properties
   * that will allow it to know the endpoints it needs to complete the authorization flow
   */
  app.get(
    '/.well-known/oauth-authorization-server',
    (_req, res: Response<AuthorizationServerMetadataResponse>) => {
      res.json({
        issuer: `${process.env.API_URL}`,

        authorization_endpoint:
          `${process.env.GARAGE_URL}/consent`,

        token_endpoint:
          `${process.env.API_URL}/token/oauth`,

        registration_endpoint:
         `${process.env.API_URL}/register/oauth`,

        response_types_supported: [ 'code' ],

        grant_types_supported: [
          OAuthGrantType.authorizationCode,
          OAuthGrantType.refreshToken,
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
   * Currently we do not have any real authorization server, but this endpoint is still
   * implemented in order not to bug the user with manual clientId creation in some IDEs (VSCode)
   */
  app.post('/register/oauth', (req, res: Response<ClientInformationResponse>) => {
    res.status(201).json({
      client_id: generateOAuthClientId(),
      client_name: req.body.client_name,
      redirect_uris: req.body.redirect_uris,
      grant_types: [OAuthGrantType.authorizationCode, OAuthGrantType.refreshToken],
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
  app.post('/authorize/oauth', async (req, res) => {
    const {
      client_id,
      redirect_uri,
      state,
      code_challenge,
    } = req.body;

    if (
      !isLoopback(redirect_uri) &&
      !ALLOWED_REDIRECT_URIS.has(redirect_uri)
    ) {
      return res.status(400).json({
        error: OAuthErrorCode.invalidRequest,
      });
    }

    const header = req.headers.authorization;

    if (typeof header !== 'string') {
      return res.status(400).json({
        error: OAuthErrorCode.invalidRequest,
      });
    }

    const loginToken = header.slice(7);

    const user = verifyJWT(loginToken, 'access');

    if (!user) {
      return res.status(400).json({
        error: OAuthErrorCode.invalidRequest,
      });
    }

    /**
     * Authorization code generation
     */
    const code = crypto
      .randomBytes(32)
      .toString('base64url');

    /**
     * Save OAuthRequest data to retrieve data on the next step
     */
    await store.saveOAuthRequest(code, {
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
   * Token endpoint is used by the client to exchange the authorization code to access token or
   * generate new {@link TokensPair} by refresh token
   *
   * ON 'authorization_code' GRANT TYPE:
   * - Validates the authorization code, validates the code verifier, and ensures that
   *   the redirect URI received matches the URI used to redirect the user agent to the client in previous step.
   *   If valid, the authorization server responds back with an access token
   *
   */
  app.post('/token/oauth', async (req: Request<{}, {}, OAuthTokenRequest>, res) => {
    const { body } = req;

    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');

    if (body.grant_type === OAuthGrantType.refreshToken) {
      const {
        refresh_token,
        client_id,
      } = body;

      if (typeof refresh_token !== 'string' || !refresh_token ||
        typeof client_id !== 'string' || !client_id) {
        return res.status(400).json({ error: OAuthErrorCode.invalidRequest });
      }

      const data = verifyJWT<OAuthJWTData>(refresh_token, 'refresh');

      if (!data) {
        return res.status(400).json({ error: OAuthErrorCode.invalidGrant });
      }

      const response = await createTokenResponse(data.jti);

      if (!response) {
        console.warn(`[OAuth] couldn't create token response for oauthId: ${data.jti}`);

        return res.status(400).json({ error: OAuthErrorCode.invalidGrant });
      }

      return res.json(response);
    }

    if (body.grant_type !== OAuthGrantType.authorizationCode) {
      return res.status(400).json({
        error: OAuthErrorCode.unsupportedGrantType,
      });
    }

    const {
      code,
      code_verifier,
      client_id,
      redirect_uri,
    } = body;

    /**
     * Retrieve OAuthRequest data from the store
     */
    const data = await store.getOAuthRequest(code);

    /**
     * Validate codeChallenge
     */
    const calculatedChallenge = crypto
      .createHash('sha256')
      .update(code_verifier)
      .digest('base64url');

    if (
      !data ||
      data.clientId !== client_id ||
      data.redirectUri !== redirect_uri ||
      calculatedChallenge !== data.codeChallenge
    ) {
      return res.status(400).json({ error: OAuthErrorCode.invalidGrant });
    }

    const oauthId = await factories.oauthFactory.create(data.userId, data.clientId);

    if (!oauthId) {
      return res.status(400).json({ error: OAuthErrorCode.invalidGrant });
    }

    const response = await createTokenResponse(oauthId);

    if (!response) {
      console.warn(`[OAuth] couldn't create token response for oauthId: ${oauthId}`);

      return res.status(400).json({ error: OAuthErrorCode.invalidGrant });
    }

    return res.json(response);
  });
};
