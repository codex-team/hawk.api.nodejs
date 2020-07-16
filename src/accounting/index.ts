import { AccountInput, CreateAccountResponse } from './types';
import { MUTATION_CREATE_ACCOUNT } from './queries';
import Client from './client';

/**
 * Class for communicating with CodeX Accounting API
 */
export default class Accounting {
  /**
   * Client for sending queries to CodeX Accounting API
   */
  private readonly client: Client;

  /**
   * Default constructor
   *
   * @param accountingURL - URL of accounting service for connection
   */
  constructor(accountingURL: string) {
    this.client = new Client(accountingURL);
  }

  /**
   * Create account in Accounting service
   *
   * @param accountInput - Account creation mutation input
   */
  public async createAccount(accountInput: AccountInput): Promise<CreateAccountResponse> {
    console.log('Create account for new workspace');
    console.log(accountInput);

    return (await this.client.call(MUTATION_CREATE_ACCOUNT, accountInput)).AccountCreateMutation;
  }
}
