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
