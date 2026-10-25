import { requireBearerAuth } from '@modelcontextprotocol/express';
import { tokenVerifier } from './tokenVerifier';

export const authMiddleware = requireBearerAuth({
  verifier: tokenVerifier,
  resourceMetadataUrl:
    `${process.env.API_URL}/.well-known/oauth-protected-resource/integration/mcp`,
});
