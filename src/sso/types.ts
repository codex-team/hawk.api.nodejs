/**
 * SAML attribute mapping configuration
 */
export interface SamlAttributeMapping {
  /**
   * Attribute name for email in SAML Assertion
   *
   * @example "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
   * to get email from XML like this:
   *  <Attribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress">
   *    <AttributeValue>alice@company.com</AttributeValue>
   *  </Attribute>
   */
  email: string;

  /**
   * Attribute name for user name in SAML Assertion
   */
  name?: string;
}

/**
 * SAML SSO configuration
 */
export interface SamlConfig {
  /**
   * IdP Entity ID.
   * Used to validate "this response is intended for Hawk"
   * @example "urn:hawk:tracker:saml"
   */
  idpEntityId: string;

  /**
   * SSO URL for redirecting user to IdP
   * Used to redirect user to IdP for authentication
   * @example "https://idp.example.com/sso"
   */
  ssoUrl: string;

  /**
   * X.509 certificate for signature verification
   * @example "-----BEGIN CERTIFICATE-----\nMIIDYjCCAkqgAwIBAgI...END CERTIFICATE-----"
   */
  x509Cert: string;

  /**
   * Desired NameID format
   * @example "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
   */
  nameIdFormat?: string;

  /**
   * Attribute mapping configuration
   * Used to extract user attributes from SAML Response
   */
  attributeMapping: SamlAttributeMapping;
}

/**
 * SSO configuration for workspace
 */
export interface WorkspaceSsoConfig {
  /**
   * Is SSO enabled
   */
  enabled: boolean;

  /**
   * Is SSO enforced (only SSO login allowed)
   * If true, login via email/password is not allowed
   */
  enforced: boolean;

  /**
   * SSO provider type
   * Currently only SAML is supported. In future we can add other providers (OAuth 2, etc.)
   */
  type: 'saml';

  /**
   * SAML-specific configuration.
   * Got from IdP metadata.
   */
  saml: SamlConfig;
}

/**
 * Data extracted from SAML Response
 */
export interface SamlResponseData {
  /**
   * NameID value (user identifier in IdP)
   */
  nameId: string;

  /**
   * User email
   */
  email: string;

  /**
   * User name (optional)
   */
  name?: string;

  /**
   * Identifier that should match AuthnRequest ID
   *
   * @example "_a8f7c3..."
   */
  inResponseTo?: string;
}

