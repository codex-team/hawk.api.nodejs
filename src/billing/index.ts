import CloudPaymentsWebhooks from './cloudpayments';
import express from 'express';
import cors from 'cors';

/**
 * Hawk billing
 */
export default class Billing {
  /**
   * Provider of cloudpayments webhooks
   */
  private providerWebhooks: CloudPaymentsWebhooks;

  /**
   * Set webhooks provider
   *
   * @param app - express app
   */
  constructor(app: express.Application) {
    this.providerWebhooks = new CloudPaymentsWebhooks();

    // @todo tune
    app.use(cors());
    app.use('/billing', this.providerWebhooks.getRouter());
  }
}
