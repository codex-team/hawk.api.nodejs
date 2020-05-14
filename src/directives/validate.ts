import { SchemaDirectiveVisitor, UserInputError } from 'apollo-server-express';
import { defaultFieldResolver, GraphQLArgument, GraphQLField, GraphQLObjectType, GraphQLInterfaceType } from 'graphql';

/**
 * Validate arguments using various functions
 * Throws an error if it doesn't pass validation
 *
 * Usage example
 *
 * extend type Mutation {
 *   updateProfile(
 *     email: String! @validate(isEmail: true)
 *     username: String! @validate(notEmpty: true)
 *   )
 * }
 */
export default class ValidateDirective extends SchemaDirectiveVisitor {
  /**
   * Validates string using regex
   * @param email - string for validatation
   */
  private static checkEmail(email: string): void {
    // eslint-disable-next-line no-useless-escape
    const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/g;

    if (email.match(emailRegex) === null) {
      throw new UserInputError('Wrong email format');
    }
  }

  /**
   * Checks a string for void, replacing all spaces
   * @param str - string for validation
   */
  private static notEmpty(str: string): void {
    if (str.replace(/\s/g, '').length == 0) {
      throw new UserInputError('The value must not be empty');
    }
  }

  /**
   * Function to call on visiting argument definition
   * @param argument - information about argument
   * @param details - details about field to resolve
   */
  public visitArgumentDefinition(argument: GraphQLArgument, details: {
      field: GraphQLField<unknown, unknown>;
      objectType: GraphQLObjectType | GraphQLInterfaceType;
  }): void {
    const { resolve = defaultFieldResolver } = details.field;

    details.field.resolve = async (object, args, context, info): Promise<void> => {
      const { notEmpty = false, isEmail = false } = this.args;

      // args[argument.name] returns the value of the argument to which the directive applies
      if (isEmail) {
        ValidateDirective.checkEmail(args[argument.name] || '');
      }

      if (notEmpty) {
        ValidateDirective.notEmpty(args[argument.name] || '');
      }

      return resolve.call(this, object, args, context, info);
    };
  }
}
