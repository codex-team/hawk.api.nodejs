/**
 * Internal types for SAML module
 * These types are used only within the SAML module implementation
 */

/**
 * Error types for SAML validation
 */
export enum SamlValidationErrorType {
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  INVALID_AUDIENCE = 'INVALID_AUDIENCE',
  INVALID_RECIPIENT = 'INVALID_RECIPIENT',
  INVALID_IN_RESPONSE_TO = 'INVALID_IN_RESPONSE_TO',
  EXPIRED_ASSERTION = 'EXPIRED_ASSERTION',
  INVALID_NAME_ID = 'INVALID_NAME_ID',
  MISSING_EMAIL = 'MISSING_EMAIL',
  /**
   * Generic validation error when specific type cannot be determined
   * Used as fallback when library error messages don't match known patterns
   */
  VALIDATION_FAILED = 'VALIDATION_FAILED',
}

/**
 * SAML validation error
 */
export class SamlValidationError extends Error {
  /**
   * Error type
   */
  public readonly type: SamlValidationErrorType;

  /**
   * Additional error context
   */
  public readonly context?: Record<string, unknown>;

  /**
   * Error construcor
   * @param type - error kind, see SamlValidationErrorType
   * @param message - string message
   * @param context - additional data
   */
  constructor(type: SamlValidationErrorType, message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'SamlValidationError';
    this.type = type;
    this.context = context;
  }
}

/**
 * Stored AuthnRequest state
 */
export interface AuthnRequestState {
  /**
   * Workspace ID
   */
  workspaceId: string;

  /**
   * Expiration timestamp
   */
  expiresAt: number;
}

/**
 * Stored RelayState data
 */
export interface RelayStateData {
  /**
   * Return URL after SSO login
   */
  returnUrl: string;

  /**
   * Workspace ID
   */
  workspaceId: string;

  /**
   * Expiration timestamp
   */
  expiresAt: number;
}
