const PaymentRequest = require('../models/paymentRequest');
const UserCard = require('../models/userCard');
const TinkoffAPI = require('tinkoff-api');
const rabbitmq = require('../rabbitmq');
const PaymentTransaction = require('../models/paymentTransaction');

/**
 * @typedef {Object} PaymentQuery
 * @property {int} amount - total payment amount in kopecs
 * @property {string} workspaceId - workspace identifier
 * @property {string} cardId - card identifier from bank
 */

/**
 * @typedef {Object} PaymentLink
 * @property {int} amount - total payment amount in kopecs
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
     * @param {ResolverObj} _obj
     * @param {string} language
     * @param {Object} user - current user object
     * @return {PaymentLink}
     */
    async attachCard(_obj, { language }, { user }) {
      const bankApi = new TinkoffAPI(process.env.TINKOFF_TERMINAL_KEY, process.env.TINKOFF_SECRET_KEY);

      const paymentQuery = {
        recurrent: 'Y',
        language: language || 'en',
        data: {
          UserId: user.id
        },
        amount: 100
      };

      const paymentRequest = await PaymentRequest.create(user.id, paymentQuery);

      console.log('INIT =>', paymentRequest);

      const result = await bankApi.initPayment(paymentRequest);

      console.log(result);
      if (!result.Success) {
        throw Error(`Merchant API error: ${result.Message} ${result.Details}`);
      }

      const transaction = await PaymentTransaction.create({
        userId: user.id,
        amount: result.Amount,
        orderId: paymentRequest.OrderId,
        paymentId: result.PaymentId,
        timestamp: parseInt((Date.now() / 1000).toFixed(0))
      });

      await rabbitmq.publish('merchant', 'merchant/initialized', JSON.stringify({
        paymentURL: result.PaymentURL,
        ...transaction
      }));
      return result;
    },
    /**
     * API Query method for getting all attached cards
     * @param {ResolverObj} _obj
     * @param {PaymentQuery} paymentQuery
     * @param {Object} user - current user object
     * @return {UserCard[]}
     */
    async getCardList(_obj, { paymentQuery }, { user }) {
      return UserCard.findByUserId(user.id);
    },
    /**
     * API Mutation method for payment
     * @param {ResolverObj} _obj
     * @param {PaymentQuery} paymentQuery
     * @param {Object} user - current user object
     * @return {boolean}
     */
    async pay(_obj, { paymentQuery }, { user }) {
      const bankApi = new TinkoffAPI(process.env.TINKOFF_TERMINAL_KEY, process.env.TINKOFF_SECRET_KEY);

      const card = await UserCard.find(user.id, paymentQuery.cardId);

      if (!card) {
        throw Error(`Merchant API error. Cannot find card: ${paymentQuery.cardId} for user ${user.id}`);
      }

      console.log(`Found card: ${card}`);

      const paymentInitQuery = {
        language: paymentQuery.language || 'en',
        data: {
          UserId: user.id
        },
        amount: paymentQuery.amount
      };
      const paymentRequest = await PaymentRequest.create(user.id, paymentInitQuery);
      const result = await bankApi.initPayment(paymentRequest);

      console.log(`Got result for charge init: ${JSON.stringify(result)}`);
      if (!result.Success) {
        throw Error(`Merchant API error: ${result.Message} ${result.Details}`);
      }

      const chargeRequest = {
        PaymentId: result.PaymentId,
        RebillId: card.rebillId
      };
      const chargeResult = await bankApi.charge(chargeRequest);

      console.log(`Got result for charge: ${JSON.stringify(chargeResult)}`);

      if (!process.env.BILLING_DEBUG) {
        if (!chargeResult.Success) {
          throw Error(`Merchant API error: ${chargeResult.Message}`);
        }
      }

      const transaction = await PaymentTransaction.create({
        userId: user.id,
        workspaceId: paymentQuery.workspaceId,
        amount: result.Amount,
        orderId: paymentRequest.OrderId,
        paymentId: result.PaymentId,
        paymentType: 'CHARGE',
        timestamp: parseInt((Date.now() / 1000).toFixed(0))
      });

      await rabbitmq.publish('merchant', 'merchant/charged', JSON.stringify(transaction));

      return true;
    }
  },
  Mutation: {
    /**
     * API Mutation method for card detach
     * @param {ResolverObj} _obj
     * @param {int} cardId - card's identifier
     * @param {Object} user - current user object
     * @return {boolean}
     */
    async removeCard(_obj, { cardId }, { user }) {
      return (await UserCard.remove({ cardId, userId: user.id })).deletedCount === 1;
    }
  }
};
