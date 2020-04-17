import { SchemaDirectiveVisitor, UserInputError } from 'apollo-server-express';
import { UnknownGraphQLField } from '../types/graphql';
import { defaultFieldResolver } from 'graphql';

/**
 * Check if the string is empty
 * Throws an error if it is
 */
export default class NotEmptyDirective extends SchemaDirectiveVisitor {
  /**
   * Function to call on visiting field definition
   * @param field - field to access
   */
  public visitFieldDefinition(field: UnknownGraphQLField): void {
    const { resolve = defaultFieldResolver } = field;

    field.resolve = async function (...args): Promise<string> {
      const result: string = await resolve.apply(this, args);

      if (result.replace(/\s/g, '').length === 0) {
        throw new UserInputError('The value must not be empty');
      }

      return result;
    };
  }
}
