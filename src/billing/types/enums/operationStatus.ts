/**
 * Payment status in case of successful completion
 */
export enum OperationStatus {
  /**
   * Status for one-step payments,
   */
  COMPLETED = 'Completed',

  /**
   * Status for two-step payments
   */
  AUTHORIZED = 'Authorized'
}