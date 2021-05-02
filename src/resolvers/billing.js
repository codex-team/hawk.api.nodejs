const PaymentRequest = require('../models/paymentRequest');
const UserCard = require('../models/userCard');
const rabbitmq = require('../rabbitmq');
const PaymentTransaction = require('../models/paymentTransaction');

/**
 * @typedef {Object} PaymentQuery
 * @property {Number} amount - total payment amount in kopecs
 * @property {string} workspaceId - workspace identifier
 * @property {string} cardId - card identifier from bank
 */

/**
 * @typedef {Object} PaymentLink
 * @property {Number} amount - total payment amount in kopecs
 * @property {string} status - payment status
 * @property {string} success - if the payment is successfull
 * @property {string} paymentURL - URL to the payment page
 */

/**
 * See all types and fields here {@link ../typeDefs/billing.graphql}
 */
module.exports = {
  Mutation: {
    /**
     * API Mutation method for card detach
     * @param {ResolverObj} _obj
     * @param {Number} cardId - card's identifier
     * @param {Object} user - current user object
     * @return {Promise<boolean>}
     */
    async removeCard(_obj, { cardId }, { user }) {
      return (await UserCard.remove({
        cardId,
        userId: user.id,
      })).deletedCount === 1;
    },

    /**
     * Mutation for getting payment link
     * @param {ResolverObj} _obj
     * @param {string} language
     * @param {Object} user - current user object
     * @return {Promise<PaymentLink>}
     */
    async attachCard(_obj, { language }, { user }) {
      const orderId = PaymentRequest.generateOrderId();
      const result = await PaymentRequest.apiInitPayment(user.id, {
        recurrent: 'Y',
        language: language || 'en',
        data: {
          UserId: user.id,
        },
        amount: 100,
        orderId: orderId,
      });
      const transaction = await PaymentTransaction.create({
        userId: user.id,
        amount: result.Amount,
        orderId: orderId,
        paymentId: result.PaymentId,
        status: result.Status,
        timestamp: parseInt((Date.now() / 1000).toFixed(0)),
      });

      await rabbitmq.publish('merchant', 'merchant/initialized', JSON.stringify({
        paymentURL: result.PaymentURL,
        ...transaction,
      }));

      return result;
    },
  },
};
