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
 * Hostnames blocked regardless of DNS resolution
 */
export const BLOCKED_HOSTNAMES: RegExp[] = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /\.lan$/i,
  /\.localdomain$/i,
];

/**
 * Only these ports are allowed for webhook delivery
 */
export const ALLOWED_PORTS: Record<string, number> = {
  'http:': 80,
  'https:': 443,
};
