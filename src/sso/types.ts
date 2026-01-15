/**
 * Re-export SSO types from @hawk.so/types
 */
export type {
  SamlAttributeMapping,
  SamlConfig,
  WorkspaceSsoConfig
} from '@hawk.so/types';

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
