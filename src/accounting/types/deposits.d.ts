/**
 * Mutation input declaration
 */
export interface DepositMutationInput {
  /**
   * Account identifier: Which account should be deposited
   */
  accountId: string;

  /**
   * Deposit amount: the increase value
   */
  amount: number;

  /**
   * Deposit purpose: short description of operation
   */
  description: string;
}