import { RelayStateData, AuthnRequestState } from './types';

/**
 * In-memory store for SAML state
 * @todo Replace with Redis for production
 */
class SamlStateStore {
  /**
   * Map of relay state IDs to relay state data
   */
  private relayStates: Map<string, RelayStateData> = new Map();

  /**
   * Map of AuthnRequest IDs to AuthnRequest state
   */
  private authnRequests: Map<string, AuthnRequestState> = new Map();

  /**
   * Time-to-live for stored state (5 minutes)
   */
  private readonly TTL = 5 * 60 * 1000;

  /**
   * Save relay state
   */
  public saveRelayState(stateId: string, data: { returnUrl: string; workspaceId: string }): void {
    this.relayStates.set(stateId, {
      ...data,
      expiresAt: Date.now() + this.TTL,
    });
  }

  /**
   * Get relay state by ID
   */
  public getRelayState(stateId: string): { returnUrl: string; workspaceId: string } | null {
    const state = this.relayStates.get(stateId);

    if (!state) {
      return null;
    }

    if (Date.now() > state.expiresAt) {
      this.relayStates.delete(stateId);
      return null;
    }

    return { returnUrl: state.returnUrl, workspaceId: state.workspaceId };
  }

  /**
   * Save AuthnRequest state
   */
  public saveAuthnRequest(requestId: string, workspaceId: string): void {
    this.authnRequests.set(requestId, {
      workspaceId,
      expiresAt: Date.now() + this.TTL,
    });
  }

  /**
   * Validate and consume AuthnRequest
   * Returns true if request is valid and not expired, false otherwise
   * Removes the request from storage after validation
   */
  public validateAndConsumeAuthnRequest(requestId: string, workspaceId: string): boolean {
    const state = this.authnRequests.get(requestId);

    if (!state) {
      return false;
    }

    if (Date.now() > state.expiresAt) {
      this.authnRequests.delete(requestId);
      return false;
    }

    if (state.workspaceId !== workspaceId) {
      this.authnRequests.delete(requestId);
      return false;
    }

    /**
     * Remove request after successful validation (prevent replay attacks)
     */
    this.authnRequests.delete(requestId);
    return true;
  }

  /**
   * Clean up expired entries (can be called periodically)
   */
  public cleanup(): void {
    const now = Date.now();

    /**
     * Clean up expired relay states
     */
    for (const [id, state] of this.relayStates.entries()) {
      if (now > state.expiresAt) {
        this.relayStates.delete(id);
      }
    }

    /**
     * Clean up expired AuthnRequests
     */
    for (const [id, state] of this.authnRequests.entries()) {
      if (now > state.expiresAt) {
        this.authnRequests.delete(id);
      }
    }
  }
}

export default new SamlStateStore();

