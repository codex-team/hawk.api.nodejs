/**
 * Available account types
 * See: https://www.principlesofaccounting.com/account-types/
 */
export enum AccountType {
  LIABILITY = 'Liability',
  ASSET = 'Asset',
  REVENUE = 'Revenue',
  EXPENSE = 'Expense'
}

/**
 * Available currencies
 */
export enum Currency {
  USD = 'USD'
}

/**
 * Account creation mutation input
 */
interface AccountInput {
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
 * Class for communicating with CodeX Accounting API
 */
export default class Accounting {
  /**
   * Accounting service URL
   */
  private readonly accountingURL: string;

  /**
   * Default constructor
   *
   * @param accountingURL - URL of accounting service for connection
   */
  constructor(accountingURL: string) {
    this.accountingURL = accountingURL;
  }

  /**
   * Create account in Accounting service
   *
   * @param accountInput - Account creation mutation input
   */
  public createAccount(accountInput: AccountInput): void {
    console.log('Create account for new workspace');
    console.log('Accounting URL: ' + this.accountingURL);
    console.log(accountInput);
    // account { create } mutation call
  }
}
