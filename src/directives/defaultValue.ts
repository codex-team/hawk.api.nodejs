import { UnknownGraphQLField } from '../types/graphql';
import {
  SchemaDirectiveVisitor
} from 'apollo-server-express';
import { defaultFieldResolver } from 'graphql';

/**
 * Directive for setting field default value
 */
module.exports = class DefaultValueDirective extends SchemaDirectiveVisitor {
  /**
   * Method to be called on field visit
   * @param field {UnknownGraphQLField} - GraphQL field definition
   */
  public visitFieldDefinition(field: UnknownGraphQLField): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any;

    try {
      value = JSON.parse(this.args.value);
    } catch (_) {
      console.warn('Value for @default directive should be JSON string.');
    }
    const { resolve = defaultFieldResolver } = field;

    field.resolve = async (object, args, context, info): Promise<any> => {
      let result = await resolve.call(this, object, args, context, info);

      if (value && !result) {
        result = value;
      }

      return result;
    };
  }
};
