import { CardType } from './enums';

/**
 * Data based on IP CloudPayments request
 */
export interface CardDetails {
  /**
   * First 6 digits of the card number
   */
  CardFirstSix: string;

  /**
   * Last 4 digits of the card number
   */
  CardLastFour: string;

  /**
   * Card payment system: Visa, MasterCard, Maestro or MIR
   */
  CardType: CardType;

  /**
   * Card expiration date in MM/YY format
   */
  CardExpDate: string;

  /**
   * Card token for repeated payments without entering details
   */
  Token?: string;
}
