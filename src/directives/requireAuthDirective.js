const {
  SchemaDirectiveVisitor,
  AuthenticationError
} = require('apollo-server-express');
const {
  AccessTokenExpiredError
} = require('../errors');
const { defaultFieldResolver } = require('graphql');

/**
 * Defines directive for accessing to a field only to authorized users
 */
class RequireAuthDirective extends SchemaDirectiveVisitor {
  /**
   * @param {GraphQLField<*,*>} field - field to access
   */
  visitFieldDefinition(field) {
    /**
     * @type {GraphQLFieldResolver<*, *>} field resolver
     */
    const {
      resolve = defaultFieldResolver,
      subscribe
    } = field;

    /**
     * New field resolver
     * @param {Array} resolverArgs - default GraphQL resolver args
     */
    field.resolve = async function (...resolverArgs) {
      const [, , context] = resolverArgs;

      RequireAuthDirective.checkUser(context);

      return resolve.apply(this, resolverArgs);
    };

    field.subscribe = async function (...resolverArgs) {
      const [, , context] = resolverArgs;

      RequireAuthDirective.checkUser(context);
      return subscribe.apply(this, resolverArgs);
    };
  }

  /**
   * Authorizes the user or throws an error if the data is incorrect
   * @param {Context} context - request context
   */
  static checkUser(context) {
    if (context.user && context.user.accessTokenExpired) {
      throw new AccessTokenExpiredError();
    }

    if (context.user && !context.user.id) {
      throw new AuthenticationError(
        'You must be signed in to view this resource.'
      );
    }
  }
}

module.exports = RequireAuthDirective;
