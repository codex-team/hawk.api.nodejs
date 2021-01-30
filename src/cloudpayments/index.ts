import express from 'express';

const router = express.Router();

/**
 * Class for describing the logic of payment routes
 */
class Cloudpayments {
  /**
   * Route for verifying a user's payment
   * https://developers.cloudpayments.ru/#check
   *
   * @param req - cloudpayments request with payment details
   * @param res - check result code
   */
  public async check(req: express.Request, res: express.Response): Promise<void> {
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
  public async pay(req: express.Request, res: express.Response): Promise<void> {
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
  public async fail(req: express.Request, res: express.Response): Promise<void> {
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
  public async recurrent(req: express.Request, res: express.Response): Promise<void> {
    res.send({
      code: 0, // Changes registered
    });
  }
}

const cloudpayments = new Cloudpayments();

router.all('/check', cloudpayments.check);
router.all('/pay', cloudpayments.pay);
router.all('/fail', cloudpayments.fail);
router.all('/recurrent', cloudpayments.recurrent);

export default router;