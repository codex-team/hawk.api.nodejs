import { ReasonCode } from './reasonCode';

/**
 * Transcript of transaction rejection code for payment failed event
 * Transcript will be used in notification after words "because of"
 * https://developers.cloudpayments.ru/#kody-oshibok
 */
export const ReasonCodesTranscript = {
  /**
   * Refusal of the issuer to conduct an online transaction
   */
  [ReasonCode.REFER_TO_CARD_ISSUER]: 'issuer refuse to conduct an online transaction',

  /**
   * Refusal of the issuer to conduct an online transaction
   */
  [ReasonCode.INVALID_MERCHANT]: 'issuer refuse to conduct an online transaction',

  /**
   * Card lost
   */
  [ReasonCode.PICK_UP_CARD]: 'the card was lost',

  /**
   * Refusal of the issuer without explanation
   */
  [ReasonCode.DO_NOT_HONOR]: 'error on the payment service side',

  /**
   * Network refusal to carry out the operation or incorrect CVV code
   */
  [ReasonCode.ERROR]: 'network refusal to carry out the operation or incorrect CVV code',

  /**
   * Card lost
   */
  [ReasonCode.PICK_UP_CARD_SPECIAL_CONDITIONS]: 'the card was lost',

  /**
   * The card is not available for online payments
   */
  [ReasonCode.INVALID_TRANSACTION]: 'the card is not available for online payments',

  /**
   * Too small or too large transaction amount
   */
  [ReasonCode.AMOUNT_ERROR]: 'too small or too large transaction amount',

  /**
   * Incorrect card number
   */
  [ReasonCode.INVALID_CARD_NUMBER]: 'incorrect card number',

  /**
   * Issuer not found
   */
  [ReasonCode.NO_SUCH_ISSUER]: 'issuer not found',

  /**
   * Refusal of the issuer without explanation
   */
  [ReasonCode.TRANSACTION_ERROR]: 'error on the payment service side',

  /**
   * Error on the acquirer's side - the transaction was incorrectly formed
   */
  [ReasonCode.FORMAT_ERROR]: 'error on the payment service side',

  /**
   * Unknown card issuer
   */
  [ReasonCode.BANK_NOT_SUPPORTED_BY_SWITCH]: 'unknown card issuer',

  /**
   * Lost card has expired
   */
  [ReasonCode.EXPIRED_CARD_PICKUP]: 'the card has expired',

  /**
   * Issuer refusal - suspicion of fraud
   */
  [ReasonCode.SUSPECTED_FRAUD]: 'error on the payment service side',

  /**
   * The card is not intended for payments
   */
  [ReasonCode.RESTRICTED_CARD]: 'the card is not intended for payments',

  /**
   * Card lost
   */
  [ReasonCode.LOST_CARD]: 'error on the payment service side',

  /**
   * Card stolen
   */
  [ReasonCode.STOLEN_CARD]: 'error on the payment service side',

  /**
   * Insufficient funds
   */
  [ReasonCode.INSUFFICIENT_FUNDS]: 'insufficient funds',

  /**
   * The card is expired or the expiration date is incorrect
   */
  [ReasonCode.TRANSACTION_NOT_PERMITTED]: 'the card has expired or the expiration date is incorrect',

  /**
   * Restriction on the card
   */
  [ReasonCode.RESTRICTED_CARD_2]: 'restriction on the card',

  /**
   * Card blocked due to security breaches
   */
  [ReasonCode.SECURITY_VIOLATION]: 'the card blocked due to security breaches',

  /**
   * The limit of card transactions has been exceeded
   */
  [ReasonCode.EXCEED_WITHDRAWAL_FREQUENCY]: 'the limit of card transactions has been exceeded',

  /**
   * Invalid CVV code
   */
  [ReasonCode.INCORRECT_CVV]: 'invalid CVV code',

  /**
   * Issuer unavailable
   */
  [ReasonCode.TIMEOUT]: 'issuer unavailable',

  /**
   * Issuer unavailable
   */
  [ReasonCode.CANNOT_REACH_NETWORK]: 'issuer unavailable',

  /**
   * Acquiring bank or network error
   */
  [ReasonCode.SYSTEM_ERROR]: 'error on the payment service side',

  /**
   * The transaction cannot be processed for other reasons
   */
  [ReasonCode.UNABLE_TO_PROCESS]: 'error on the payment service side',

  /**
   * 3-D Secure authorization failed
   */
  [ReasonCode.AUTHENTICATION_FAILED]: '3-D Secure authorization failed',

  /**
   * 3-D Secure authorization not available
   */
  [ReasonCode.AUTHENTICATION_UNAVAILABLE]: '3-D Secure authorization not available',

  /**
   * Acquiring limits for transactions
   */
  [ReasonCode.ANTI_FRAUD]: 'acquiring limits for transactions',
};
