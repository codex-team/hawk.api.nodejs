import { AccountType } from './accountType';
import { Currency } from './currency';

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
