/**
 * Data for setting up recurring payments
 */
interface RecurrentPaymentSettings {
  /**
   * Payment interval
   */
  interval: 'Day' | 'Week' | 'Month';

  /**
   * Payment period. That is, how often to withdraw money
   */
  period: number;

  /**
   * Subscription start date (first payment)
   */
  startDate?: string;

  /**
   * Recurring payment amount.
   */
  amount?: number;
}

/**
 * Data for the needs of Cloudpayments
 */
interface CloudPaymentsSettings {
  /**
   * Data for recurrent payments
   *
   * @see https://developers.cloudpayments.ru/#rekurrentnye-platezhi-podpiska
   */
  recurrent: RecurrentPaymentSettings;
}

export interface PaymentData {
  /**
   * Data for Cloudpayments needs
   */
  cloudPayments?: CloudPaymentsSettings;
  /**
   * Workspace Identifier
   */
  workspaceId: string;
  /**
   * Id of the user making the payment
   */
  userId: string;
  /**
   * Workspace current plan id or plan id to change
   */
  tariffPlanId: string;
  /**
   * If true, we will save user card
   */
  shouldSaveCard: boolean;
  /**
   * True if this is card linking operation – charging minimal amount of money to validate card info
   */
  isCardLinkOperation: boolean;
}
