const {
  SchemaDirectiveVisitor,
} = require('apollo-server-express');
const { defaultFieldResolver } = require('graphql');

/**
 * Directive for renaming type fields
 */
module.exports = class RenameFromDirective extends SchemaDirectiveVisitor {
  /**
   * Method to be called on field visit
   * @param field {GraphQLField<any, any>} - GraphQL field definition
   */
  visitFieldDefinition(field) {
    const { name } = this.args;
    const { resolve = defaultFieldResolver } = field;

    field.resolve = async (object, args, context, info) => {
      object[field.name] = object[name];
      delete object[name];

      return resolve.call(this, object, args, context, info);
    };
  }
};
