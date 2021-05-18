import axios, { AxiosInstance } from 'axios';

/**
 * Settings for CloudPayments API
 */
interface CloudPaymentsApiSettings {
  /**
   * Public id for the site
   */
  publicId: string;

  /**
   * Site's secret
   */
  secret: string;
}

/**
 * Data for setting up recurrent payments
 */
interface RecurrentPaymentData {
  /**
   * Payment interval
   */
  interval: 'Day' | 'Week' | 'Month';

  /**
   * Payment period. That is, how often to withdraw money
   */
  period: number;
}

/**
 * Data for CloudPayments internal purposes
 */
interface CloudPaymentsData {
  /**
   * Data for recurrent payments
   *
   * @see https://developers.cloudpayments.ru/#rekurrentnye-platezhi-podpiska
   */
  recurrent: RecurrentPaymentData;
}

/**
 * Data to be sent with pay event to and back from payments server
 */
export interface CloudPaymentsJsonData {
  /**
   * Hash to check data
   */
  checksum: string;

  /**
   * Data for Cloudpayments needs
   */
  cloudPayments?: CloudPaymentsData;
}

/**
 * Payload of the API method to process payment via token
 */
interface PayWithTokenPayload {
  /**
   * Payment amount
   */
  Amount: number;

  /**
   * User ID from payment parameters
   */
  AccountId: string;

  /**
   * Card token for processing payment
   */
  Token: string;

  /**
   * Other data for request
   */
  JsonData: CloudPaymentsJsonData;

  /**
   * Currency: RUB/USD
   */
  Currency: string;
}

/**
 * Response of the API method to process payment via token
 */
interface PayWithCardResponse {
  /**
   * Operation status
   */
  Success: boolean;
  Model: {
    /**
     * Id of the transaction
     */
    TransactionId: number;
  };
}

/**
 * Class for interacting with CloudPayments API
 * @see https://developers.cloudpayments.ru/#api
 */
class CloudPaymentsApi {
  /**
   * CloudPayments public id
   */
  private readonly publicId: string;

  /**
   * CloudPayments API secret
   */
  private readonly secret: string;

  /**
   * Axios instance to make calls to API
   */
  private readonly api: AxiosInstance;

  /**
   * Creates class instance
   * @param settings - settings for class initialization
   */
  constructor(settings: CloudPaymentsApiSettings) {
    this.publicId = settings.publicId;
    this.secret = settings.secret;

    this.api = axios.create({
      baseURL: 'https://api.cloudpayments.ru/',
      auth: {
        username: this.publicId,
        password: this.secret,
      },
    });
  }

  /**
   * Cancel subscription by its id
   *
   * @param subscriptionId - subscription id to cancel
   */
  public async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.api.post('/subscriptions/cancel', {
      Id: subscriptionId,
    });
  }

  /**
   * Process payment via token
   *
   * @param input - data for payment processing
   */
  public async payByToken(input: PayWithTokenPayload): Promise<PayWithCardResponse> {
    return (await this.api.post('/payments/tokens/charge', input)).data;
  }

  /**
   * Cancels the payment by transaction ID
   *
   * @param transactionId - transaction id to cancel
   */
  public async cancelPayment(transactionId: number): Promise<void> {
    await this.api.post('/payments/void', {
      TransactionId: transactionId,
    });
  }
}

export default new CloudPaymentsApi({
  publicId: process.env.CLOUDPAYMENTS_PUBLIC_ID || '',
  secret: process.env.CLOUDPAYMENTS_SECRET || '',
});
