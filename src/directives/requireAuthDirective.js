const {
  SchemaDirectiveVisitor,
  AuthenticationError
} = require('apollo-server-express');
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
    const { resolve = defaultFieldResolver } = field;

    /**
     * New field resolver
     * @param {Array} resolverArgs - default GraphQL resolver args
     */
    field.resolve = async function (...resolverArgs) {
      const [, , context] = resolverArgs;

      if (context.user && !context.user.id) {
        throw new AuthenticationError(
          'You must be signed in to view this resource.'
        );
      } else {
        return resolve.apply(this, resolverArgs);
      }
    };
  }
}

module.exports = RequireAuthDirective;
