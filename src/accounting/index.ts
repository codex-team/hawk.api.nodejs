import { AccountInput, CreateAccountResponse } from './types';
import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { MUTATION_CREATE_ACCOUNT } from './queries';
import fs from 'fs';

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
      ca: fs.readFileSync(`${__dirname}/ca.pem`),
      cert: fs.readFileSync(`${__dirname}/client.pem`),
      key: fs.readFileSync(`${__dirname}/client-key.pem`),
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
  public async createAccount(accountInput: AccountInput): Promise<CreateAccountResponse> {
    console.log('Create account for new workspace');
    console.log('Accounting URL: ' + this.accountingURL);
    console.log(accountInput);

    return (await this.call(MUTATION_CREATE_ACCOUNT, accountInput)).AccountCreateMutation;
  }

  /**
   * Returns accounting URL endpoint
   */
  private get accountingURL(): string {
    return this.accountingApiInstance.defaults.baseURL || '';
  }

  /**
   * Calls Accounting service and returns response
   *
   * @param query - request to send
   * @param variables - request variables
   */
  private async call(
    query: string,
    variables?: object
    // eslint-disable-next-line
  ): Promise<any> {
    const response = await this.accountingApiInstance.post(this.accountingURL, {
      query,
      variables,
    });

    return response;
  }
}
