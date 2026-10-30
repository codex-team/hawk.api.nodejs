import { requireBearerAuth } from '@modelcontextprotocol/express';
import { tokenVerifier } from './tokenVerifier';

/**
 * Express middleware that requires a valid Bearer token in the Authorization header
 *
 * On failure the middleware sends a JSON OAuth error body and a WWW-Authenticate: Bearer …
 * challenge that includes the configured resource_metadata URL
 * so clients can discover the Authorization Server
 */
export const authMiddleware = requireBearerAuth({
  verifier: tokenVerifier,
  resourceMetadataUrl:
    `${process.env.API_URL}/.well-known/oauth-protected-resource/integration/mcp`,
});
