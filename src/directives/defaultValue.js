const {
  SchemaDirectiveVisitor,
} = require('apollo-server-express');
const { defaultFieldResolver } = require('graphql');

/**
 * Directive for setting field default value
 */
module.exports = class DefaultValueDirective extends SchemaDirectiveVisitor {
  /**
   * Method to be called on field visit
   * @param field {GraphQLField<any, any>} - GraphQL field definition
   */
  visitFieldDefinition(field) {
    let value;

    try {
      value = JSON.parse(this.args.value);
    } catch (_) {
      console.warn('Value for @default directive should be JSON string.');
    }
    const { resolve = defaultFieldResolver } = field;

    field.resolve = async (object, args, context, info) => {
      let result = await resolve.call(this, object, args, context, info);

      if (value && !result) {
        result = value;
      }

      return result;
    };
  }
};
