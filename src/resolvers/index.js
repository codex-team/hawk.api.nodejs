const isE2E = require('../utils/isE2E').default;
const { merge } = require('lodash');
const {
  LongResolver,
  PositiveIntResolver,
  DateTimeResolver,
  JSONResolver,
  JSONObjectResolver,
} = require('graphql-scalars');
const user = require('./user').default;
const workspace = require('./workspace');
const project = require('./project');
const event = require('./event');
const plans = require('./plans').default;
const projectNotifications = require('./projectNotifications').default;
const userNotifications = require('./userNotifications').default;
const billing = require('./billingNew').default;
const EncodedJSON = require('./encodedJSON').default;
const seed = require('./seed').default;

/**
 * @typedef ResolverObj
 * @see https://www.apollographql.com/docs/graphql-tools/resolvers#resolver-function-signature
 * Object that contains the result returned from the resolver on the parent field,
 * or, in the case of a top-level Query field,
 * the rootValue passed from the server configuration.
 * This argument enables the nested nature of GraphQL queries.
 */

/**
 * @typedef ResolverArgs
 * @see https://www.apollographql.com/docs/graphql-tools/resolvers#resolver-function-signature
 * Object with the arguments passed into the field in the query.
 * For example, if the field was called with author(name: "Ada"), the args object would be: { "name": "Ada" }.
 */

/**
 * See all types and fields here {@link ../typeDefs/schema.graphql}
 */
const indexResolver = {
  Query: {
    /**
     * Healthcheck endpoint
     * @return {string}
     */
    health: () => 'ok',
  },
  // DateTime scalar resolver
  DateTime: DateTimeResolver,

  // JSON values resolver
  JSON: JSONResolver,

  // JSON object resolver
  JSONObject: JSONObjectResolver,

  // Represents JSON objects encoded (or not) in string format
  EncodedJSON,

  // Allow only positive integers
  PositiveInt: PositiveIntResolver,

  // Allow big int numbers
  Long: LongResolver,
};

const resolvers = [
  indexResolver,
  user,
  workspace,
  project,
  event,
  projectNotifications,
  userNotifications,
  plans,
  billing,
];

if (isE2E) {
  resolvers.push(seed);
}

module.exports = merge(...resolvers);
