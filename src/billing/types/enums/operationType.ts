/**
 * Operation type
 */
export enum OperationType {
  /**
   * Payment operation
   */
  PAYMENT = 'Payment',

  /**
   * Refund operation
   */
  REFUND = 'Refund',

  /**
   * Payout to card
   */
  CARD_PAYOUT = 'CardPayout'
}