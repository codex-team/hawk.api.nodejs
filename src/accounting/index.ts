import Client from './client';
import { AccountInput, CreateAccountResponse, Settings, Account, TransactionResponse, DepositMutationInput, DepositMutationParams, PurchaseMutationInput } from './types';
import { MUTATION_CREATE_ACCOUNT, QUERY_GET_ACCOUNT, MUTATION_PAY_ONCE, MUTATION_PURCHASE } from './queries';

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

  /**
   * Charge money
   *
   * @param input - data for debiting money
   */
  public async purchase(input: PurchaseMutationInput): Promise<TransactionResponse> {
    const transaction: TransactionResponse = (await this.client.call(MUTATION_PURCHASE, {
      input,
    })).data.data.purchase;

    return transaction;
  }

  /**
   * Increase account balance
   *
   * @param input - data for depositing money
   */
  public async payOnce(input: DepositMutationInput): Promise<TransactionResponse> {
    console.log('Call MUTATION_PAY_ONCE');
    const transaction: TransactionResponse = (await this.client.call(MUTATION_PAY_ONCE, {
      input,
    })).data.data;

    console.log('TRANSACTION', transaction);

    return transaction;
  }
}
