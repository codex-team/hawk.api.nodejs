import { SchemaDirectiveVisitor, UserInputError } from 'apollo-server-express';
import { defaultFieldResolver, GraphQLArgument, GraphQLField, GraphQLObjectType, GraphQLInterfaceType } from 'graphql';

/**
 * Check if the argument is empty
 * Throws an error if it is
 */
export default class ValidateDirective extends SchemaDirectiveVisitor {
  /**
   * Function to call on visiting argument definition
   * @param argument - information about argument
   * @param details - details about field to resolve
   */
  public visitArgumentDefinition(argument: GraphQLArgument, details: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      field: GraphQLField<any, any>;
      objectType: GraphQLObjectType | GraphQLInterfaceType;
  }): void {
    const { resolve = defaultFieldResolver } = details.field;

    details.field.resolve = async (object, args, context, info): Promise<void> => {
      const { notEmpty = false, isEmail = false} = this.args;

      if (isEmail) {
        const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/g;
        
        if (args[argument.name] && args[argument.name].match(emailRegex) === null){
          throw new UserInputError('Wrong email format');
        }
      } 
      
      if (notEmpty) {
        if (args[argument.name] && args[argument.name].replace(/\s/g, '').length == 0) {
          throw new UserInputError('The value must not be empty');
        }
      }

      return resolve.call(this, object, args, context, info);
    };
  }
}
