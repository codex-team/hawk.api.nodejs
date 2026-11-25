
/* eslint-disable @typescript-eslint/camelcase, camelcase */

import { UserJWTData } from 'src/types/graphql';

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

/**
 * Additional data encoded into tokens issued for OAuth
 */
export type OAuthJWTData = UserJWTData & {
  /**
   * Client identifier
   */
  clientId: string;

  /**
   * Expiration time (Unix timestamp in seconds)
   */
  exp: number;

  /**
   * Unique JSON Web Token Identifier
   */
  jti: string;
}
