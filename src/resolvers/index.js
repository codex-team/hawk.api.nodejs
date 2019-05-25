const user = require('./user');
const { merge } = require('lodash');

/**
 * @typedef ResolverObj
 * @link https://www.apollographql.com/docs/graphql-tools/resolvers#resolver-function-signature
 * Object that contains the result returned from the resolver on the parent field,
 * or, in the case of a top-level Query field,
 * the rootValue passed from the server configuration.
 * This argument enables the nested nature of GraphQL queries.
 */

/**
 * @typedef ResolverArgs
 * @link https://www.apollographql.com/docs/graphql-tools/resolvers#resolver-function-signature
 * Object with the arguments passed into the field in the query.
 * For example, if the field was called with author(name: "Ada"), the args object would be: { "name": "Ada" }.
 */

/**
 * See all types and fields here {@see ../typeDefs/schema.graphql}
 */
const indexResolver = {
  Query: {
    /**
     * Healthcheck endpoint
     * @return {string}
     */
    health: () => 'ok'
  }
};

module.exports = merge(
  indexResolver,
  user
);
