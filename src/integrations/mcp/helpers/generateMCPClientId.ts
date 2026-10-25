import crypto from 'node:crypto';

export function generateMCPClientId() {
  return `hawk-client:${crypto.randomUUID()}`;
};
