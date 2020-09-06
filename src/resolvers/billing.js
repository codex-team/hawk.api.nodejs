const PaymentRequest = require('../models/paymentRequest');
const UserCard = require('../models/userCard');
const rabbitmq = require('../rabbitmq');
const PaymentTransaction = require('../models/paymentTransaction');
const Membership = require('../models/membership');
// const BusinessOperation = require('../models/businessOperation');

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
  Query: {
    /**
     * API Query method for getting all attached cards
     * @param {ResolverObj} _obj
     * @param {PaymentQuery} paymentQuery
     * @param {Object} user - current user object
     * @return {Promise<UserCard[]>}
     */
    async cardList(_obj, { paymentQuery }, { user }) {
      return UserCard.findByUserId(user.id);
    },

    /**
     * API Query method for getting all transactions for passed workspaces
     * @param _obj
     * @param {string[]} ids - ids of workspaces for which transactions have been requested
     * @param {User} user - current authorized user
     * @returns {Promise<BusinessOperation>}
     */
    async transactions(_obj, { ids }, { user }) {
      /*
       * @todo check if user has permissions to get transactions
       * @todo refactor resolver for new business operation model and factory
       */

      const membership = new Membership(user.id);

      const allowedIds = await membership.getWorkspacesIds();

      if (ids.length === 0) {
        ids = allowedIds;
      } else {
        ids = ids.filter(id => allowedIds.includes(id));
      }

      return [];
    },
  },
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

    /**
     * Mutation for payment with attached card
     * @param {ResolverObj} _obj
     * @param {PaymentQuery} paymentQuery
     * @param {Object} user - current user object
     * @return {Promise<boolean>}
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
          UserId: user.id,
        },
        amount,
        orderId,
      });

      /*
       * Charge payment with bank API
       * const chargeResult = await bankApi.charge({
       *   PaymentId: result.PaymentId,
       *   RebillId: card.rebillId,
       * });
       */

      /*
       * console.log(`Got result for charge: ${JSON.stringify(chargeResult)}`);
       * if (!process.env.BILLING_DEBUG) {
       *   if (!chargeResult.Success) {
       *     throw Error(`Merchant API error: ${chargeResult.Message}`);
       *   }
       * }
       */

      const transaction = await PaymentTransaction.create({
        userId: user.id,
        workspaceId,
        amount,
        orderId,
        paymentId: result.PaymentId,
        status: 'CHARGE',
        timestamp: parseInt((Date.now() / 1000).toFixed(0)),
      });

      await rabbitmq.publish('merchant', 'merchant/charged', JSON.stringify(transaction));

      return true;
    },

    /**
     * Mutation for single payment
     * @param {ResolverObj} _obj
     * @param {PaymentQuery} paymentQuery
     * @param {Object} user - current user object
     * @return {Promise<boolean>}
     */
    async payOnce(_obj, { input }, { user, factories }) {
      const { amount, language, workspaceId } = input;

      /**
       * Wait for acquiring
       *
       * const orderId = PaymentRequest.generateOrderId();
       *
       * const result = await PaymentRequest.apiInitPayment(user.id, {
       *   language: language || 'en',
       *   data: {
       *     UserId: user.id,
       *   },
       *   amount,
       *   orderId: orderId,
       * });
       *
       * const transaction = await PaymentTransaction.create({
       *   userId: user.id,
       *   workspaceId,
       *   amount,
       *   orderId,
       *   paymentId: result.PaymentId,
       *   status: 'SINGLE',
       *   timestamp: parseInt((Date.now() / 1000).toFixed(0)),
       * });
       */

      const workspaceModel = await factories.workspacesFactory.findById(workspaceId);

      if (!workspaceModel) {
        throw new UserInputError('There is no workspace with provided id');
      }

      try {
        const transaction = await accounting.payOnce({
          accountId: workspaceModel.accountId,
          amount,
          description: 'Depositing balance by one-time payment',
        });

        // Create a business operation
        const payloadWorkspacePlanPurchase = {
          workspaceId: workspaceModel._id,
          amount,
        };

        const businessOperationData = {
          transactionId: transaction.recordId,
          type: BusinessOperationType.DepositByUser,
          status: BusinessOperationStatus.Confirmed,
          payload: payloadWorkspacePlanPurchase,
        };

        await factories.businessOperationsFactory.create(businessOperationData);
      } catch (err) {
        console.error('\nლ(´ڡ`ლ) Error [resolvers:billing:payOnce]: \n\n', err, '\n\n');
        HawkCatcher.send(err);

        throw new ApolloError('An error occurred while depositing the balance');
      }

      console.log('NICE BOII');

      return {
        recordId: workspaceModel._id,
        record: workspaceModel,
      };

      /**
       * await rabbitmq.publish('merchant', 'merchant/initialized', JSON.stringify(transaction));
       *
       * return result;
       */
    },
  },
};
