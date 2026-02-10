/**
 * Generic test data generators.
 *
 * Keep these helpers narrowly scoped and named by intent to avoid mixing concerns
 * (e.g. do not use SAML ID generator for emails).
 */

/**
 * Generates a unique test string.
 *
 * Useful when tests run in parallel and share the same DB: unique values prevent
 * collisions and accidental cross-test matches.
 *
 * Format: `{prefix}-{timestamp}-{random}`
 *
 * @example const testEmail = generateTestString('factory-test-sso@example.com');
 */
export function generateTestString(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);

  return `${prefix}-${timestamp}-${random}`;
}


