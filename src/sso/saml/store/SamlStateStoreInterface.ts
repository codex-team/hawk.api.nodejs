/**
 * Interface for SAML state store implementations
 *
 * Defines contract for storing temporary SAML authentication state:
 * - RelayState: maps state ID to return URL and workspace ID
 * - AuthnRequests: maps request ID to workspace ID for InResponseTo validation
 */
export interface SamlStateStoreInterface {
  /**
   * Store type identifier
   * Used for logging and debugging purposes
   *
   * @example "redis" or "memory"
   */
  readonly type: string;

  /**
   * Save RelayState data
   *
   * @param stateId - unique state identifier (usually UUID)
   * @param data - relay state data (returnUrl, workspaceId)
   */
  saveRelayState(stateId: string, data: { returnUrl: string; workspaceId: string }): Promise<void>;

  /**
   * Get and consume RelayState data
   *
   * @param stateId - state identifier
   * @returns relay state data or null if not found/expired
   */
  getRelayState(stateId: string): Promise<{ returnUrl: string; workspaceId: string } | null>;

  /**
   * Save AuthnRequest for InResponseTo validation
   *
   * @param requestId - SAML AuthnRequest ID
   * @param workspaceId - workspace ID
   */
  saveAuthnRequest(requestId: string, workspaceId: string): Promise<void>;

  /**
   * Validate and consume AuthnRequest
   *
   * @param requestId - SAML AuthnRequest ID (from InResponseTo)
   * @param workspaceId - expected workspace ID
   * @returns true if request is valid and matches workspace
   */
  validateAndConsumeAuthnRequest(requestId: string, workspaceId: string): Promise<boolean>;

  /**
   * Stop cleanup timer (for testing)
   * Optional method - only needed for in-memory store
   */
  stopCleanupTimer?(): void;

  /**
   * Clear all stored state (for testing)
   * Optional method - only needed for in-memory store
   */
  clear?(): void;
}
