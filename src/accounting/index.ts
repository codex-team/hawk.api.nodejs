import { AccountInput, CreateAccountResponse, Settings, Account } from './types';
import { MUTATION_CREATE_ACCOUNT, QUERY_GET_ACCOUNT } from './queries';
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
   * @param settings - settings for client module
   */
  constructor(settings: Settings) {
    this.client = new Client(settings);
  }

  /**
   * Create account in Accounting service
   *
   * @param accountInput - Account creation mutation input
   */
  public async createAccount(accountInput: AccountInput): Promise<CreateAccountResponse> {
    console.log('Create account for new workspace');
    console.log(accountInput);

    return (await this.client.call(MUTATION_CREATE_ACCOUNT, {
      input: accountInput,
    })).data.data.account.create;
  }

  /**
   * Get workspace account
   *
   * @param accountId - workspace account id
   */
  public async getAccount(accountId: string): Promise<Account> {
    /**
     * Uncomment when balance is ready
     *
     * const account = (await this.client.call(QUERY_GET_ACCOUNT, {
     *  id: accountId
     * })).data.data.getAccount;
     */

    const response = {
      id: '575204f4-4a5e-485d-aa68-c5af38a05555',
      name: 'Workspace_name',
      currency: 'USD',
      balance: 228,
    };

    return response;
  }
}
