const { ApolloError } = require('apollo-server-express');
const Workspace = require('../models/workspace');
const Team = require('../models/team');
const Membership = require('../models/membership');
const User = require('../models/user');
const { ProjectToWorkspace } = require('../models/project');
const TinkoffAPI = require('tinkoff-api');
const PaymentRequest = require('../models/paymentRequest');

/**
 * See all types and fields here {@link ../typeDefs/merchant.graphql}
 */
module.exports = {
  Query: {
    /**
     * paymentLink endpoint
     * @return {string}
     */
    async paymentLink(_obj, { paymentRequest }, { user }) {
      const bankApi = new TinkoffAPI(process.env.TINKOFF_TERMINAL_KEY, process.env.TINKOFF_SECRET_KEY);
      const result = await bankApi.init(paymentRequest);

      if (!result.Success) {
        throw Error(`Merchant API error: ${result.Message} ${result.Details}`);
      }
      return result;
    }
  }
};
