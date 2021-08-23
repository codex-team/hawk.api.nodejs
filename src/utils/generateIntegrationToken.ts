/**
 * Maximum value of random hash in integration token
 */
const RANDOM_HASH_MAX = 999999;

/**
 * Generates new integration token with integration id field
 *
 * @param integrationId - integration id for using in collector URL
 */
export default function generateIntegrationToken(integrationId: string): string {
  const randomHash = Math.round(Math.random() * RANDOM_HASH_MAX);

  const decodedIntegrationToken = {
    integrationId,
    randomHash,
  };

  return Buffer
    .from(JSON.stringify(decodedIntegrationToken))
    .toString('base64');
}
