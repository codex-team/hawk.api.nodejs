const PaymentRequest = require('../models/paymentRequest');
const TinkoffAPI = require('tinkoff-api');
const rabbitmq = require('../rabbitmq');

/**
 * See all types and fields here {@link ../typeDefs/merchant.graphql}
 */
module.exports = {
  Query: {
    /**
     * API Query method for getting payment link
     * @return {string}
     */
    async paymentLink(_obj, { paymentQuery }, { user }) {
      const bankApi = new TinkoffAPI(process.env.TINKOFF_TERMINAL_KEY, process.env.TINKOFF_SECRET_KEY);

      const paymentRequest = await PaymentRequest.create(user.id, paymentQuery);
      const result = await bankApi.initPayment(paymentRequest);

      if (!result.Success) {
        throw Error(`Merchant API error: ${result.Message} ${result.Details}`);
      }

      await rabbitmq.publish('merchant', 'merchant/initialized', JSON.stringify({
        orderId: result.OrderId,
        paymentId: result.PaymentId,
        paymentURL: result.PaymentURL,
        workspaceId: paymentQuery.workspaceId,
        userId: user.id,
        timestamp: new Date(),
        status: result.Status
      }));
      return result;
    }
  }
};
