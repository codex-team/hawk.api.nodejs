const PaymentRequest = require('../models/paymentRequest');
const UserCard = require('../models/userCard');
const TinkoffAPI = require('tinkoff-api');
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
 * Tinkoff bank API
 * @type {TinkoffAPI}
 */
const bankApi = new TinkoffAPI(process.env.TINKOFF_TERMINAL_KEY, process.env.TINKOFF_SECRET_KEY);

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
      const orderId = PaymentRequest.generateOrderId();
      const result = await PaymentRequest.apiInitPayment(user.id, {
        recurrent: 'Y',
        language: language || 'en',
        data: {
          UserId: user.id
        },
        amount: 100,
        orderId: orderId
      });
      const transaction = await PaymentTransaction.create({
        userId: user.id,
        amount: result.Amount,
        orderId: orderId,
        paymentId: result.PaymentId,
        status: result.Status,
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
     * API Mutation method for payment with attached card
     * @param {ResolverObj} _obj
     * @param {PaymentQuery} paymentQuery
     * @param {Object} user - current user object
     * @return {boolean}
     */
    async payWithCard(_obj, { amount, language, cardId, workspaceId }, { user }) {
      const orderId = PaymentRequest.generateOrderId();
      const card = await UserCard.find(user.id, cardId);

      if (!card) {
        throw Error(`Merchant API error. Cannot find card: ${cardId} for user ${user.id}`);
      }
      console.log(`Found card: ${card}`);

      // Get paymentId from bank API
      const result = await PaymentRequest.apiInitPayment(user.id, {
        language: language || 'en',
        data: {
          UserId: user.id
        },
        amount,
        orderId
      });

      // Charge payment with bank API
      const chargeResult = await bankApi.charge({
        PaymentId: result.PaymentId,
        RebillId: card.rebillId
      });

      console.log(`Got result for charge: ${JSON.stringify(chargeResult)}`);
      if (!process.env.BILLING_DEBUG) {
        if (!chargeResult.Success) {
          throw Error(`Merchant API error: ${chargeResult.Message}`);
        }
      }
      const transaction = await PaymentTransaction.create({
        userId: user.id,
        workspaceId,
        amount,
        orderId,
        paymentId: result.PaymentId,
        status: 'CHARGE',
        timestamp: parseInt((Date.now() / 1000).toFixed(0))
      });

      await rabbitmq.publish('merchant', 'merchant/charged', JSON.stringify(transaction));
      return true;
    },

    /**
     * API Mutation method for single payment
     * @param {ResolverObj} _obj
     * @param {PaymentQuery} paymentQuery
     * @param {Object} user - current user object
     * @return {boolean}
     */
    async payOnce(_obj, { amount, language, workspaceId }, { user }) {
      const orderId = PaymentRequest.generateOrderId();
      const result = await PaymentRequest.apiInitPayment(user.id, {
        language: language || 'en',
        data: {
          UserId: user.id
        },
        amount,
        orderId: orderId
      });

      const transaction = await PaymentTransaction.create({
        userId: user.id,
        workspaceId,
        amount,
        orderId,
        paymentId: result.PaymentId,
        status: 'SINGLE',
        timestamp: parseInt((Date.now() / 1000).toFixed(0))
      });

      await rabbitmq.publish('merchant', 'merchant/initialized', JSON.stringify(transaction));

      return result;
    }
  },
  Mutation: {
    /**
     * API Mutation method for card detach
     * @param {ResolverObj} _obj
     * @param {Number} cardId - card's identifier
     * @param {Object} user - current user object
     * @return {boolean}
     */
    async removeCard(_obj, { cardId }, { user }) {
      return (await UserCard.remove({ cardId, userId: user.id })).deletedCount === 1;
    }
  }
};
