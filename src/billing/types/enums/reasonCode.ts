/**
 * Transaction rejection code
 * https://developers.cloudpayments.ru/#kody-oshibok
 */
export enum ReasonCode {
  /**
   * Refusal of the issuer to conduct an online transaction
   */
  REFER_TO_CARD_ISSUER = 5001,

  /**
   * Refusal of the issuer to conduct an online transaction
   */
  INVALID_MERCHANT = 5003,

  /**
   * Card lost
   */
  PICK_UP_CARD = 5004,

  /**
   * Refusal of the issuer without explanation
   */
  DO_NOT_HONOR = 5005,

  /**
   * Network refusal to carry out the operation or incorrect CVV code
   */
  ERROR = 5006,

  /**
   * Card lost
   */
  PICK_UP_CARD_SPECIAL_CONDITIONS = 5007,

  /**
   * The card is not available for online payments
   */
  INVALID_TRANSACTION = 5012,

  /**
   * Too small or too large transaction amount
   */
  AMOUNT_ERROR = 5013,

  /**
   * Incorrect card number
   */
  INVALID_CARD_NUMBER = 5014,

  /**
   * Issuer not found
   */
  NO_SUCH_ISSUER = 5015,

  /**
   * Refusal of the issuer without explanation
   */
  TRANSACTION_ERROR = 5019,

  /**
   * Error on the acquirer's side - the transaction was incorrectly formed
   */
  FORMAT_ERROR = 5030,

  /**
   * Unknown card issuer
   */
  BANK_NOT_SUPPORTED_BY_SWITCH = 5031,

  /**
   * Lost card has expired
   */
  EXPIRED_CARD_PICKUP = 5033,

  /**
   * Issuer refusal - suspicion of fraud
   */
  SUSPECTED_FRAUD = 5034,

  /**
   * The card is not intended for payments
   */
  RESTRICTED_CARD = 5036,

  /**
   * Card lost
   */
  LOST_CARD = 5041,

  /**
   * Card stolen
   */
  STOLEN_CARD = 5043,

  /**
   * Insufficient funds
   */
  INSUFFICIENT_FUNDS = 5051,

  /**
   * The card is expired or the expiration date is incorrect
   */
  TRANSACTION_NOT_PERMITTED = 5057,

  /**
   * Restriction on the card
   */
  RESTRICTED_CARD_2 = 5062,

  /**
   * Card blocked due to security breaches
   */
  SECURITY_VIOLATION = 5063,

  /**
   * The limit of card transactions has been exceeded
   */
  EXCEED_WITHDRAWAL_FREQUENCY = 5065,

  /**
   * Invalid CVV code
   */
  INCORRECT_CVV = 5082,

  /**
   * Issuer unavailable
   */
  TIMEOUT = 5091,

  /**
   * Issuer unavailable
   */
  CANNOT_REACH_NETWORK = 5092,

  /**
   * Acquiring bank or network error
   */
  SYSTEM_ERROR = 5096,

  /**
   * The transaction cannot be processed for other reasons
   */
  UNABLE_TO_PROCESS = 5204,

  /**
   * 3-D Secure authorization failed
   */
  AUTHENTICATION_FAILED = 5206,

  /**
   * 3-D Secure authorization not available
   */
  AUTHENTICATION_UNVAILABLE = 5207,

  /**
   * Acquiring limits for transactions
   */
  ANTI_FRAUD = 5300
}
