
/* eslint-disable @typescript-eslint/camelcase, camelcase */

/**
 * Base parameters included in every request to
 * '/token/integration/mcp'
 */
type TokenRequestBase = {
  grant_type: string;
  client_id: string;
  resource: string;
};

/**
 * Parameters for an authorization code token request
 * to '/token/integration/mcp'
 */
type AuthorizationTokenRequest = TokenRequestBase & {
  grant_type: 'authorization_code';
  code: string;
  code_verifier: string;
  redirect_uri: string;
};

/**
 * Parameters for a refresh token request
 * to '/token/integration/mcp'
 */
type RefreshTokenRequest = TokenRequestBase & {
  grant_type: 'refresh_token';
  refresh_token: string;
};

/**
 * Union of authorization code and refresh token requests
 */
export type TokenRequest =
  | AuthorizationTokenRequest
  | RefreshTokenRequest;

/**
 * Parameters for {@link https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-16#name-token-endpoint-response | Token Endpoint Response}
 */
export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
};

/**
 * Parameters for {@link https://datatracker.ietf.org/doc/html/rfc9728#name-protected-resource-metadata-r | Protected Resource Metadata Response}
 */
export type ProtectedResourceMetadataResponse = {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  resource_documentation?: string;
};

/**
 * Parameters for {@link https://datatracker.ietf.org/doc/html/rfc8414 | Server Metadata Response}
 */
export type AuthorizationServerMetadataResponse = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  code_challenge_methods_supported: string[];
};

/**
 * Parameters for {@link https://www.rfc-editor.org/info/rfc7591/#section-3.2.1 | Client Information Response}
 */
export type ClientInformationResponse = {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
};
