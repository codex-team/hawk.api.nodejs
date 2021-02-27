import CloudPaymentsWebhooks from './cloudpayments';
import express from 'express';
import cors from 'cors';

/**
 * Hawk billing
 */
export default class Billing {
  /**
   * Append billing routes to the express app
   *
   * @param app - express app
   */
  public appendRoutes(app: express.Application): void {
    const providerWebhooks = new CloudPaymentsWebhooks();

    app.use(cors());
    app.use('/billing', providerWebhooks.getRouter());
  }
}
