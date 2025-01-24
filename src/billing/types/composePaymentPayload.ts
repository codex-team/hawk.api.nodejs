export interface ComposePaymentPayload {
  /**
   * Workspace Identifier
   */
  workspaceId: string;
  /**
   * Id of the user making the payment
   */
  userId: string;
  /**
   * Workspace current plan id or plan id to change
   */
  tariffPlanId: string;
  /**
   * If true, we will save user card
   */
  shouldSaveCard: 'true' | 'false';
  /**
   * True if this is card linking operation – charging minimal amount of money to validate card info
   */
  isCardLinkOperation: 'true' | 'false';
}
