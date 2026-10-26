import crypto from 'node:crypto';

/**
 * Generates random MCP clientId
 * @returns string
 */
export function generateMCPClientId() {
  return `hawk-client:${crypto.randomUUID()}`;
};
