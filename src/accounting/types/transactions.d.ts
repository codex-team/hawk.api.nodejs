import { string } from "../../utils/validator"

/**
 * Available transaction types
 */
export enum TransactionType {
  /**
   * Transaction that increases account and cashbook
   */
  Deposit = 'Deposit',

  /**
   * Transaction that decreases account and cashbook
   */
  Withdraw = 'Withdraw',

  /**
   * Tranasction that decreases account and increases our revenue
   */
  Purchase = 'Purchase'
}

/**
 * Transaction data interface
 */
export interface TransactionData {
  /**
   * Transaction unique identifier (UUIDv4)
   */
  id?: string;

  /**
   * One of the transaction type described above
   */
  type?: TransactionType;

  /**
   * Short transaction purpose
   */
  description?: string;

  /**
   * Transaction creation datetime
   */
  dtCreated?: number;
}

/**
 * Transaction response
 */
export interface TransactionResponse {
  /**
   * Transaction id
   */
  recordId?: string;

  /**
   * Full transaction data
   */
  record?: TransactionData;
}