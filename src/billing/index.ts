import CloudPaymentsWebhooks from './cloudpayments';
import express from 'express';

/**
 * Hawk billing
 */
export default class Billing {
  /**
   * Set webhooks provider
   *
   * @param app - express app
   */
  public createRoutes(app: express.Application): void {
    const providerWebhooks = new CloudPaymentsWebhooks();

    app.use('/billing', providerWebhooks.getRouter());
  }
}