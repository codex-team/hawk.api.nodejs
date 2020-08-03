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

    return (await this.client.call(MUTATION_CREATE_ACCOUNT, accountInput)).AccountCreateMutation;
  }

  /**
   * Get workspace account
   *
   * @param workspaceId - workspace id
   */
  public async getAccount(workspaceId: string): Promise<Account> {
    console.log('Try to get an acoount', workspaceId);

    return (await this.client.call(QUERY_GET_ACCOUNT, workspaceId)).GetAccount;
  }
}
