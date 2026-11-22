import crypto from 'node:crypto';

/**
 * Generates random clientId
 * @returns string
 */
export function generateOAuthClientId() {
  return `hawk-client:${crypto.randomUUID()}`;
};
