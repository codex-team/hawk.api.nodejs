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

    app.use(cors(this.corsOptionDelegate));
    app.use('/billing', this.providerWebhooks.getRouter());
  }

  /**
   * Enables or Disables request on origin
   *
   * @param req - Express request object
   * @param callback — Function that enables request execution on origin (uses special allowed list)
   */
  private corsOptionDelegate(req: express.Request, callback: Function): void {
    const allowList = [
      'http://localhost:8080',
      'https://hawk.so',
      'https://beta.hawk.so',
      'https://stage.beta.hawk.so',
    ];

    const origin = req.header('Origin') || '';

    if (allowList.indexOf(origin) !== -1) {
      callback(null, { origin: true });
    } else {
      callback(null, { origin: false });
    }
  }
}
