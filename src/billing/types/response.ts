/**
 * Basic response to cloud payments
 */
export interface CPResponse {
  /**
   * Code of response
   */
  code: number;
}

/**
 * Response for the check route
 */
export interface CheckResponse extends CPResponse {
  code: CheckCodes;
}

/**
 * Response for the pay route
 */
export interface PayResponse extends CPResponse {
  code: PayCodes;
}

/**
 * Response for the fail route
 */
export interface FailResponse extends CPResponse {
  code: FailCodes;
}

/**
 * Response for the recurrent route
 */
export interface RecurrentResponse extends CPResponse {
  code: RecurrentCodes;
}

/**
 * Codes of check route response
 */
export enum CheckCodes {
  /**
   * Payment can be made
   */
  SUCCESS = 0,

  /**
   * Invalid invoice number
   */
  INVALID_INVOICE_ID = 10,

  /**
   * Incorrect AccountId
   */
  INCORRECT_ACCOUNT_ID = 11,

  /**
   * Wrong payment amount
   */
  WRONG_AMOUNT = 12,

  /**
   * Any other reason for refusal
   */
  PAYMENT_COULD_NOT_BE_ACCEPTED = 13,

  /**
   * Payment is overdue
   */
  PAYMENT_IS_OVERDUE = 20
}

/**
 * Codes of pay route response
 */
export enum PayCodes {
  /**
   * Payment registered
   */
  SUCCESS = 0,
}

/**
 * Codes of fail route response
 */
export enum FailCodes {
  /**
   * Attempt registered
   */
  SUCCESS = 0,
}

/**
 * Codes of reccurrent route response
 */
export enum RecurrentCodes {
  /**
   * Changes registered
   */
  SUCCESS = 0,
}