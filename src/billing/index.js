const PaymentRequest = require('../models/paymentRequest');
const TinkoffAPI = require('tinkoff-api');

/**
 * Billing class
 */
class Billing {
  static async notifyCallback(req, res) {
    const body = req.body;
    const api = new TinkoffAPI(process.env.TINKOFF_TERMINAL_KEY, process.env.TINKOFF_SECRET_KEY);

    if (body.Status === 'AUTHORIZED') {
      const payment = await PaymentRequest.findByOrderId(body.OrderId);

      if (!payment) {
        console.error(`Not found ${body.OrderId}`);
        console.log(await api.cancelPayment({ PaymentId: body.PaymentId }));

        return res.send('OK');
      }

      const token = api.generateToken(body);

      if (token !== body.Token) {
        console.error(`Token mismatched ${token} and ${JSON.stringify(body)}`);
        return res.send('ERROR');
      }

      await PaymentRequest.setParams(payment.orderId, {
        cardId: body.CardId,
        rebillId: body.RebillId,
        status: body.Status
      });

      const result = await api.confirmPayment({
        PaymentId: body.PaymentId
      });

      if (!result.Success) {
        console.error(`Confirm action error: ${result.Message} ${result.Details}`);
      }

      await PaymentRequest.setParams(payment.orderId, { status: result.Status });
    }

    return res.send('OK');
  };
}

module.exports = Billing;
