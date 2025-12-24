import { SAML, SamlConfig as NodeSamlConfig, Profile } from '@node-saml/node-saml';
import { SamlConfig, SamlResponseData } from '../types';
import { SamlValidationError, SamlValidationErrorType } from './types';
import { extractAttribute } from './utils';

/**
 * Service for SAML SSO operations
 */
export default class SamlService {
  /**
   * Generate SAML AuthnRequest
   *
   * @param workspaceId - workspace ID
   * @param acsUrl - Assertion Consumer Service URL
   * @param relayState - context of user returning (url + relay state id)
   * @param samlConfig - SAML configuration
   * @returns AuthnRequest ID and encoded SAML request
   */
  public async generateAuthnRequest(
    workspaceId: string,
    acsUrl: string,
    relayState: string,
    samlConfig: SamlConfig
  ): Promise<{ requestId: string; encodedRequest: string }> {
    const saml = this.createSamlInstance(acsUrl, samlConfig);

    /**
     * Generate AuthnRequest message
     * node-saml returns object with SAMLRequest (deflated + base64 encoded)
     */
    const authorizeMessage = await saml.getAuthorizeMessageAsync(relayState, undefined, {});

    const encodedRequest = authorizeMessage.SAMLRequest as string;

    if (!encodedRequest) {
      throw new Error('Failed to generate SAML AuthnRequest');
    }

    /**
     * Extract request ID from the generated request
     * node-saml generates unique ID internally using generateUniqueId option
     * We need to decode and parse to get the ID for InResponseTo validation
     */
    const requestId = this.extractRequestIdFromEncodedRequest(encodedRequest);

    return {
      requestId,
      encodedRequest,
    };
  }

  /**
   * Extract request ID from encoded SAML AuthnRequest
   *
   * @param encodedRequest - deflated and base64 encoded SAML request
   * @returns request ID
   */
  private extractRequestIdFromEncodedRequest(encodedRequest: string): string {
    const zlib = require('zlib');

    /**
     * Decode base64 and inflate
     */
    const decoded = Buffer.from(encodedRequest, 'base64');
    const inflated = zlib.inflateRawSync(decoded).toString('utf-8');

    /**
     * Extract ID attribute from AuthnRequest XML
     * Format: <samlp:AuthnRequest ... ID="_abc123" ...>
     */
    const idMatch = inflated.match(/ID="([^"]+)"/);

    if (!idMatch || !idMatch[1]) {
      throw new Error('Failed to extract request ID from AuthnRequest');
    }

    return idMatch[1];
  }

  /**
   * Validate and parse SAML Response
   *
   * @param samlResponse - base64-encoded SAML Response
   * @param workspaceId - workspace ID
   * @param acsUrl - expected Assertion Consumer Service URL
   * @param samlConfig - SAML configuration
   * @param expectedRequestId - optional expected InResponseTo value (if provided, validates that response matches)
   * @returns parsed SAML response data
   * @throws SamlValidationError if validation fails
   */
  public async validateAndParseResponse(
    samlResponse: string,
    workspaceId: string,
    acsUrl: string,
    samlConfig: SamlConfig,
    expectedRequestId?: string
  ): Promise<SamlResponseData> {
    const saml = this.createSamlInstance(acsUrl, samlConfig);

    let profile: Profile;

    try {
      /**
       * node-saml validates:
       * - XML signature using x509Cert
       * - Audience (via idpIssuer option)
       * - Time conditions (NotBefore, NotOnOrAfter with clock skew)
       */
      const result = await saml.validatePostResponseAsync({
        SAMLResponse: samlResponse,
      });

      if (!result.profile) {
        throw new SamlValidationError(
          SamlValidationErrorType.INVALID_SIGNATURE,
          'SAML response validation failed: no profile returned'
        );
      }

      profile = result.profile;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown SAML validation error';

      /**
       * Determine specific error type based on error message
       */
      if (message.includes('signature')) {
        throw new SamlValidationError(
          SamlValidationErrorType.INVALID_SIGNATURE,
          `SAML signature validation failed: ${message}`
        );
      }

      if (message.includes('expired') || message.includes('NotOnOrAfter') || message.includes('NotBefore')) {
        throw new SamlValidationError(
          SamlValidationErrorType.EXPIRED_ASSERTION,
          `SAML assertion time validation failed: ${message}`
        );
      }

      if (message.includes('audience') || message.includes('Audience')) {
        throw new SamlValidationError(
          SamlValidationErrorType.INVALID_AUDIENCE,
          `SAML audience validation failed: ${message}`
        );
      }

      /**
       * Fallback for unknown error types
       * Note: Error classification relies on message text which may change between library versions
       */
      throw new SamlValidationError(
        SamlValidationErrorType.VALIDATION_FAILED,
        `SAML validation failed: ${message}`
      );
    }

    /**
     * Extract NameID (Profile type defines nameID as required string)
     */
    const nameId = profile.nameID;

    if (!nameId) {
      throw new SamlValidationError(
        SamlValidationErrorType.INVALID_NAME_ID,
        'SAML response does not contain NameID'
      );
    }

    /**
     * Extract InResponseTo and validate if expectedRequestId provided
     * Profile uses index signature [attributeName: string]: unknown for additional properties
     */
    const inResponseTo = profile.inResponseTo as string | undefined;

    if (expectedRequestId && inResponseTo !== expectedRequestId) {
      throw new SamlValidationError(
        SamlValidationErrorType.INVALID_IN_RESPONSE_TO,
        `InResponseTo mismatch: expected ${expectedRequestId}, got ${inResponseTo}`,
        { expected: expectedRequestId, received: inResponseTo }
      );
    }

    /**
     * Extract attributes from profile
     * node-saml puts SAML attributes directly on the profile object via index signature
     */
    const attributes = profile as unknown as Record<string, string | string[]>;

    /**
     * Extract email using attributeMapping
     */
    const email = extractAttribute(attributes, samlConfig.attributeMapping.email);

    if (!email) {
      throw new SamlValidationError(
        SamlValidationErrorType.MISSING_EMAIL,
        `Email attribute not found in SAML response. Expected attribute: ${samlConfig.attributeMapping.email}`,
        { attributeMapping: samlConfig.attributeMapping }
      );
    }

    /**
     * Extract name using attributeMapping (optional)
     */
    let name: string | undefined;

    if (samlConfig.attributeMapping.name) {
      name = extractAttribute(attributes, samlConfig.attributeMapping.name);
    }

    return {
      nameId,
      email,
      name,
      inResponseTo,
    };
  }

  /**
   * Create node-saml SAML instance with given configuration
   *
   * @param acsUrl - Assertion Consumer Service URL
   * @param samlConfig - SAML configuration from workspace
   * @returns configured SAML instance
   */
   private createSamlInstance(acsUrl: string, samlConfig: SamlConfig): SAML {
    const spEntityId = process.env.SSO_SP_ENTITY_ID;

    if (!spEntityId) {
      throw new Error('SSO_SP_ENTITY_ID environment variable is not set');
    }

    const options: NodeSamlConfig = {
      callbackUrl: acsUrl,
      entryPoint: samlConfig.ssoUrl,
      issuer: spEntityId,
      idpIssuer: samlConfig.idpEntityId,
      idpCert: samlConfig.x509Cert,
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: false,
      /**
       * Allow 2 minutes clock skew for time validation
       */
      acceptedClockSkewMs: 2 * 60 * 1000,
    };

    if (samlConfig.nameIdFormat) {
      options.identifierFormat = samlConfig.nameIdFormat;
    }

    return new SAML(options);
  }
}

