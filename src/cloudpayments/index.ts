import express from 'express';

/**
 * Class for describing the logic of payment routes
 */
class Cloudpayments {
  /**
   * Payment routes
   */
  public router = express.Router();

  /**
   * Set routes
   */
  constructor() {
    this.router.all('/check', this.check);
    this.router.all('/pay', this.pay);
    this.router.all('/fail', this.fail);
    this.router.all('/recurrent', this.recurrent);
  }

  /**
   * Route for verifying a user's payment
   * https://developers.cloudpayments.ru/#check
   *
   * @param req - cloudpayments request with payment details
   * @param res - check result code
   */
  private async check(req: express.Request, res: express.Response): Promise<void> {
    res.send({
      code: 0, // Payment can be made
    });
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
      code: 0, // Payment registered
    });
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
      code: 0, // Attempt registered
    });
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
      code: 0, // Changes registered
    });
  }
}

const cloudpayments = new Cloudpayments();

export default cloudpayments.router;