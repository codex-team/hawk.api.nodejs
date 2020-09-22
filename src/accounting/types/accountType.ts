/**
 * Available account types
 * See: https://www.principlesofaccounting.com/account-types/
 */
export enum AccountType {
  /**
   * When we need to pay some money to someone (credit)
   */
  LIABILITY = 'Liability',

  /**
   * Something valuable belonging to a person or organization
   * that can be used for the payment of debts (debit) — Cashbook
   */
  ASSET = 'Asset',

  /**
   * When we have some money earned from services (credit)
   */
  REVENUE = 'Revenue',

  /**
   * When we pay some our money for some serivces (debit)
   */
  EXPENSE = 'Expense'
}