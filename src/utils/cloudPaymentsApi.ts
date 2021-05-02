import axios, { AxiosInstance } from 'axios';

interface CloudPaymentsApiSettings {
  publicId: string;
  secret: string;
}

interface PayWithTokenPayload {
  Amount: number;
  AccountId: string;
  Token: string;
  JsonData: unknown;
  Currency: string;
}

interface PayWithCardResponse {
  Success: boolean;
  Model: {
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
}

export default new CloudPaymentsApi({
  publicId: process.env.CLOUDPAYMENTS_PUBLIC_ID || '',
  secret: process.env.CLOUDPAYMENTS_SECRET || '',
});
