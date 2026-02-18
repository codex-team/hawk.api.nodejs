import dns from 'dns';
import { isPrivateIP } from './ipValidator';

/**
 * Hostnames blocked regardless of DNS resolution
 */
const BLOCKED_HOSTNAMES: RegExp[] = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /\.lan$/i,
  /\.localdomain$/i,
];

/**
 * Only these ports are allowed for webhook delivery
 */
const ALLOWED_PORTS: Record<string, number> = {
  'http:': 80,
  'https:': 443,
};

/**
 * Validates a webhook endpoint URL for SSRF safety.
 * Returns null if valid, or an error message string if invalid.
 *
 * Checks:
 * - Protocol whitelist (http/https)
 * - Port whitelist (80/443)
 * - Hostname blocklist (localhost, *.local, etc.)
 * - Private IP in URL
 * - DNS resolution — all A/AAAA records must be public
 *
 * @param endpoint - webhook URL to validate
 */
export async function validateWebhookEndpoint(endpoint: string): Promise<string | null> {
  let url: URL;

  try {
    url = new URL(endpoint);
  } catch {
    return 'Invalid webhook URL';
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return 'Webhook URL must use http or https protocol';
  }

  const requestedPort = url.port ? Number(url.port) : ALLOWED_PORTS[url.protocol];

  if (requestedPort !== ALLOWED_PORTS[url.protocol]) {
    return `Webhook URL port ${requestedPort} is not allowed — only 80 (http) and 443 (https)`;
  }

  const hostname = url.hostname;

  if (BLOCKED_HOSTNAMES.some((pattern) => pattern.test(hostname))) {
    return `Webhook hostname "${hostname}" is not allowed`;
  }

  if (isPrivateIP(hostname)) {
    return 'Webhook URL points to a private/reserved IP address';
  }

  try {
    const results = await dns.promises.lookup(hostname, { all: true });

    for (const { address } of results) {
      if (isPrivateIP(address)) {
        return `Webhook hostname resolves to a private IP address (${address})`;
      }
    }
  } catch {
    return `Cannot resolve webhook hostname "${hostname}"`;
  }

  return null;
}
