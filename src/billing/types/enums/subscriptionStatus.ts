/**
 * Possible subscription status
 */
export enum SubscriptionStatus {
  /**
   * Subscription active.
   * After creation and next successful payment
   */
  ACTIVE = 'Active',

  /**
   * Subscription expired.
   * After one or two consecutive unsuccessful payment attempts
   */
  PASTDUE = 'PastDue',

  /**
   * Subscription cancelled.
   * In case of cancellation upon request
   */
  CANCELLED = 'Cancelled',

  /**
   * Subscription rejected.
   * In case of three unsuccessful payment attempts in a row
   */
  REJECTED = 'Rejected',

  /**
   * Subscription expired.
   * In case of completion of the maximum number of periods (if specified)
   */
  EXPIRED = 'Expired'
}
