/**
 * Utility functions for SAML operations
 */

/**
 * Extract attribute value from SAML Assertion attributes
 *
 * @param attributes - SAML attributes object
 * @param attributeName - name of the attribute to extract
 * @returns attribute value or undefined if not found
 */
export function extractAttribute(attributes: Record<string, string | string[]>, attributeName: string): string | undefined {
  const value = attributes[attributeName];

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }

  return undefined;
}

/**
 * Validate PEM certificate format
 *
 * @param cert - certificate string
 * @returns true if certificate appears to be valid PEM format
 */
export function isValidPemCertificate(cert: string): boolean {
  return cert.includes('-----BEGIN CERTIFICATE-----') && cert.includes('-----END CERTIFICATE-----');
}

