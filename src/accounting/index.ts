import { AccountInput } from './types/accountInput';

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
