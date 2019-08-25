const PaymentRequest = require('../models/paymentRequest');
const TinkoffAPI = require('tinkoff-api');
const rabbitmq = require('../rabbitmq');

/**
 * Billing class
 */
class Billing {
  static async notifyCallback(req, res) {
    const body = req.body;
    const api = new TinkoffAPI(process.env.TINKOFF_TERMINAL_KEY, process.env.TINKOFF_SECRET_KEY);
    const token = api.generateToken(body);

    if (token !== body.Token) {
      console.error(`Token mismatched ${token} and ${JSON.stringify(body)}`);
      return res.send('ERROR');
    }

    if (body.Status === 'AUTHORIZED') {
      body.Timestamp = new Date();
      await rabbitmq.publish('merchant', 'merchant/authorized', JSON.stringify(body));
      return res.send('OK');
    }

    if (body.Status === 'CONFIRMED') {
      return res.send('OK');
    }
  };
}

module.exports = Billing;
