import express from 'express';

import { CheckCodes, CheckResponse, PayCodes, PayResponse, FailCodes, FailResponse, RecurrentResponse, RecurrentCodes } from './types';

/**
 * Class for describing the logic of payment routes
 */
export default class CloudPaymentsWebhooks {
  /**
   * Returns router for payments
   *
   * @returns - express router for payments
   */
  public getRouter(): express.Router {
    const router = express.Router();

    router.get('/compose-payment', this.composePayment);
    router.all('/check', this.check);
    router.all('/pay', this.pay);
    router.all('/fail', this.fail);
    router.all('/recurrent', this.recurrent);

    return router;
  }

  /**
   * Prepares payment data before charge
   *
   * @param req — Express request object
   * @param res - Express response object
   */
  private async composePayment(req: express.Request, res: express.Response): Promise<void> {
    const { workspaceId, tariffId } = req.query;

    /**
     * @todo fetch workspace data: name, tariff and so on. I need services to work with storages
     */
    const tariff = 'Basic';
    const invoiceId = `CDX 21-02-04 ${tariff}`;
    const plan = {
      id: '',
      name: '',
    };

    res.send({
      workspaceId: workspaceId,
      tariffId: tariffId,
      invoiceId: invoiceId,
      amount: 299,
      plan: plan,
      currency: 'USD',
      checksum: 'some hash',
    });
  }

  /**
   * Route to confirm the correctness of a user's payment
   * https://developers.cloudpayments.ru/#check
   *
   * @param req - cloudpayments request with payment details
   * @param res - check result code
   */
  private async check(req: express.Request, res: express.Response): Promise<void> {
    res.send({
      code: CheckCodes.SUCCESS,
    } as CheckResponse);
  }

  /**
   * Route for fixing a successful payment
   * https://developers.cloudpayments.ru/#pay
   *
   * @param req - cloudpayments request with payment details
   * @param res - result code
   */
  private async pay(req: express.Request, res: express.Response): Promise<void> {
    res.send({
      code: PayCodes.SUCCESS,
    } as PayResponse);
  }

  /**
   * Route for refused payments
   * https://developers.cloudpayments.ru/#fail
   *
   * @param req - cloudpayments request with payment details
   * @param res - result code
   */
  private async fail(req: express.Request, res: express.Response): Promise<void> {
    res.send({
      code: FailCodes.SUCCESS,
    } as FailResponse);
  }

  /**
   * Route is executed if the status of the recurring payment subscription has been changed.
   * https://developers.cloudpayments.ru/#recurrent
   *
   * @param req - cloudpayments request with subscription details
   * @param res - result code
   */
  private async recurrent(req: express.Request, res: express.Response): Promise<void> {
    res.send({
      code: RecurrentCodes.SUCCESS,
    } as RecurrentResponse);
  }
}
