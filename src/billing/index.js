const TinkoffAPI = require('tinkoff-api');
const rabbitmq = require('../rabbitmq');

const PAYMENT_AUTHORIZED = 'AUTHORIZED';
const PAYMENT_CONFIRMED = 'CONFIRMED';

/**
 * Billing class
 */
class Billing {
  /**
   * Callback action for Tinkoff payment notification {@link https://oplata.tinkoff.ru/landing/develop/notifications/parametres}
   * @param req
   * @param res
   * @return {Promise<void>}
   */
  static async notifyCallback(req, res) {
    const body = req.body;
    const api = new TinkoffAPI(process.env.TINKOFF_TERMINAL_KEY, process.env.TINKOFF_SECRET_KEY);
    const token = api.generateToken(body);

    if (token !== body.Token) {
      console.error(`Token mismatched ${token} and ${JSON.stringify(body)}`);

      return res.send('ERROR');
    }

    console.log('NOTIFICATION FROM BANK => ', body);

    // Send authorized payments to RabbitMQ
    if (body.Status === PAYMENT_AUTHORIZED) {
      body.Timestamp = parseInt((Date.now() / 1000).toFixed(0));
      await rabbitmq.publish('merchant', 'merchant/authorized', JSON.stringify(body));

      return res.send('OK');
    }

    // Just ACK payment confirmation notification
    if (body.Status === PAYMENT_CONFIRMED) {
      return res.send('OK');
    }
  };
}

module.exports = Billing;
