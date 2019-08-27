const PaymentRequest = require('../models/paymentRequest');
const UserCard = require('../models/userCard');
const TinkoffAPI = require('tinkoff-api');
const rabbitmq = require('../rabbitmq');

/**
 * @typedef {Object} PaymentLink
 * @property {string} amount - total payment amount in kopecs
 * @property {string} status - payment status
 * @property {string} success - if the payment is successfull
 * @property {string} paymentURL - URL to the payment page
 */

/**
 * See all types and fields here {@link ../typeDefs/merchant.graphql}
 */
module.exports = {
  Query: {
    /**
     * API Query method for getting payment link
     * @return {PaymentLink}
     */
    async paymentLink(_obj, { paymentQuery }, { user }) {
      const bankApi = new TinkoffAPI(process.env.TINKOFF_TERMINAL_KEY, process.env.TINKOFF_SECRET_KEY);

      // set rebillId by default
      paymentQuery.rebillId = 'Y';
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
    },
    /**
     * API Query method for getting all attached cards
     * @return {UserCard[]}
     */
    async getCardList(_obj, { paymentQuery }, { user }) {
      return UserCard.findByUserId(user.id);
    }
  },
  Mutation: {
    /**
     * API Mutation method for card attach
     * @return {boolean}
     */
    async addCard(_obj, { cardData }, { user }) {
      const card = await UserCard.findOne({ cardNumber: cardData.cardNumber });
      if (card) {
        return false;
      } else {
        UserCard.create({
          userId: user.id,
          ...cardData
        });
        return true;
      }
    },
    /**
     * API Mutation method for card detach
     * @return {boolean}
     */
    async removeCard(_obj, { cardNumber }, { user }) {
      return (await UserCard.remove({ cardNumber, userId: user.id })).deletedCount === 1;
    }
  }
};
