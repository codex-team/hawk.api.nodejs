import { AccountType, Currency } from './index';

/**
 * Account creation mutation input
 */
export interface AccountInput {
  /**
   * String that describes account purpose
   */
  name: string;

  /**
   * Account type according to the balance sheet
   * See: https://www.principlesofaccounting.com/account-types/
   */
  type: AccountType;

  /**
   * Account currency
   */
  currency: Currency;
}

/**
 * Response of creating new account
 */
export interface CreateAccountResponse {
  /**
   * Created account identifier
   */
  recordId: string;
}

/**
 * Account purchase input
 */
export interface PurchaseMutationInput {
  /**
   * Account ID from which the amount is debited
   */
  accountId: string;

  /**
   * Purchase amount: the decrease value
   */
  amount: number;

  /**
   * Purchase purpose: short description of operation
   */
  description: string;
}