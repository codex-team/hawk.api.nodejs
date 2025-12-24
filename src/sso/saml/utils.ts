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

/**
 * Validate Audience value
 *
 * @param audience - audience value from SAML Assertion
 * @returns true if audience matches SSO_SP_ENTITY_ID
 * @throws Error if SSO_SP_ENTITY_ID environment variable is not set
 */
export function validateAudience(audience: string): boolean {
  const spEntityId = process.env.SSO_SP_ENTITY_ID;

  if (!spEntityId) {
    throw new Error('SSO_SP_ENTITY_ID environment variable is not set');
  }

  return audience === spEntityId;
}

/**
 * Validate Recipient value
 *
 * @param recipient - recipient URL from SAML Assertion
 * @param expectedAcsUrl - expected ACS URL
 * @returns true if recipient matches expected ACS URL
 */
export function validateRecipient(recipient: string, expectedAcsUrl: string): boolean {
  return recipient === expectedAcsUrl;
}

/**
 * Validate time conditions (NotBefore and NotOnOrAfter)
 *
 * @param notBefore - NotBefore timestamp
 * @param notOnOrAfter - NotOnOrAfter timestamp
 * @param clockSkew - allowed clock skew in milliseconds (default: 2 minutes)
 * @returns true if assertion is valid at current time
 */
export function validateTimeConditions(
  notBefore: Date,
  notOnOrAfter: Date,
  clockSkew: number = 2 * 60 * 1000
): boolean {
  const now = Date.now();
  const notBeforeTime = notBefore.getTime() - clockSkew;
  const notOnOrAfterTime = notOnOrAfter.getTime() + clockSkew;

  return now >= notBeforeTime && now < notOnOrAfterTime;
}

