
/**
 * Base parameters included in every request to
 * '/token/integration/mcp'.
 */
type TokenRequestBase = {
  grant_type: string;
  client_id: string;
  resource: string;
};

/**
 * Parameters for an authorization code token request
 * to '/token/integration/mcp'.
 */
type AuthorizationTokenRequest = TokenRequestBase & {
  grant_type: 'authorization_code';
  code: string;
  code_verifier: string;
  redirect_uri: string;
};

/**
 * Parameters for a refresh token request
 * to '/token/integration/mcp'.
 */
type RefreshTokenRequest = TokenRequestBase & {
  grant_type: 'refresh_token';
  refresh_token: string;
};

/**
 * Union of authorization code and refresh token requests.
 */
export type TokenRequest =
  | AuthorizationTokenRequest
  | RefreshTokenRequest;
