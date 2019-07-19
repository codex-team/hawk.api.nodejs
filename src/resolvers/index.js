const { merge } = require('lodash');
const { GraphQLDateTime } = require('graphql-iso-date');
const { GraphQLJSON, GraphQLJSONObject } = require('graphql-type-json');
const user = require('./user');
const workspace = require('./workspace');
const project = require('./project');
const event = require('./event');

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
    health: () => 'ok'
  },
  // DateTime scalar resolver
  DateTime: GraphQLDateTime,
  // JSON values resolver
  JSON: GraphQLJSON,
  // JSON object resolver
  JSONObject: GraphQLJSONObject
};

module.exports = merge(indexResolver, user, workspace, project, event);
