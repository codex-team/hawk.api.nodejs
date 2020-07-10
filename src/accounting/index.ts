import { AccountInput } from './types';
import axios, { AxiosInstance } from 'axios';
import https from 'https';

/**
 * Class for communicating with CodeX Accounting API
 */
export default class Accounting {
  /**
   * Instance of axios for connection to CodeX Accounting API
   */
  private readonly accountingApiInstance: AxiosInstance;

  /**
   * Default constructor
   *
   * @param accountingURL - URL of accounting service for connection
   */
  constructor(accountingURL: string) {
    const httpsAgent = new https.Agent({
      /*
       * ca: file,
       * cert: file,
       * key: file,
       */
    });

    this.accountingApiInstance = axios.create({
      baseURL: accountingURL,
      timeout: 1000,
      httpsAgent: httpsAgent,
    });
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
    /*
     * this.accountingApiInstance.post('url', 'data');
     */
  }

  /**
   * Returns accounting URL endpoint
   */
  private get accountingURL(): string {
    return this.accountingApiInstance.defaults.baseURL || '';
  }
}
