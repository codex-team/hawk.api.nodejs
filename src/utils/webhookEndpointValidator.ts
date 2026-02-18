import dns from 'dns';

/**
 * Regex patterns matching private/reserved IP ranges:
 *
 * IPv4: 0.x (current-network), 10.x, 172.16-31.x, 192.168.x (RFC1918),
 * 127.x (loopback), 169.254.x (link-local/metadata), 100.64-127.x (CGN/RFC6598),
 * 255.255.255.255 (broadcast), 224-239.x (multicast),
 * 192.0.2.x, 198.51.100.x, 203.0.113.x (documentation), 198.18-19.x (benchmarking).
 *
 * IPv6: ::1, ::, fe80 (link-local), fc/fd (ULA), ff (multicast).
 *
 * Also handles IPv4-mapped IPv6 (::ffff:A.B.C.D) and zone IDs (fe80::1%lo0).
 */
const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^255\.255\.255\.255$/,
  /^2(2[4-9]|3\d)\./,
  /^192\.0\.2\./,
  /^198\.51\.100\./,
  /^203\.0\.113\./,
  /^198\.1[89]\./,
  /^::1$/,
  /^::$/,
  /^fe80/i,
  /^f[cd]/i,
  /^ff[0-9a-f]{2}:/i,
  /^::ffff:(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/i,
];

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
 * Checks whether an IP address belongs to a private/reserved range.
 * Strips zone ID before matching (e.g. fe80::1%lo0).
 *
 * @param ip - IP address string (v4 or v6)
 */
export function isPrivateIP(ip: string): boolean {
  const bare = ip.split('%')[0];

  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(bare));
}

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
