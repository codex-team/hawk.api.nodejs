import {defaultFieldResolver, GraphQLSchema} from "graphql";
import {mapSchema, MapperKind, getDirective, getDirectives} from '@graphql-tools/utils'
import {UserInputError} from "apollo-server-express";
import {BooleanValueNode} from "graphql/language/ast";

/**
 * Validates string using regex
 * @param email - string for validatation
 */
function checkEmail(email: string): void {
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
function checkNotEmpty(str: string): void {
  if (str.replace(/\s/g, '').length == 0) {
  throw new UserInputError('The value must not be empty');
}
}

export default function validateDirective(directiveName = 'validate') {
  return {
    validateDirectiveTypeDefs:`
    """
    Directive for checking a field for empty space
    """
    directive @${directiveName}(notEmpty: Boolean, isEmail: Boolean) on ARGUMENT_DEFINITION
    `,
    validateDirectiveTransformer: (schema: GraphQLSchema) =>
      mapSchema(schema, {
        [MapperKind.MUTATION_ROOT_FIELD]: (fieldConfig, fieldName) => {
          const args = fieldConfig.astNode?.arguments;
          if (args) {
            args.forEach(arg => {
              const directives = arg.directives;
              directives?.forEach(directive => {
                if (directive.name.value === directiveName) {
                  const directiveArguments = directive.arguments;
                  const isEmail = (directiveArguments?.find(arg => arg.name.value === 'isEmail')?.value as BooleanValueNode)?.value;
                  const notEmpty = (directiveArguments?.find(arg => arg.name.value === 'notEmpty')?.value as BooleanValueNode)?.value;
                  if (isEmail || notEmpty) {
                    const { resolve = defaultFieldResolver } = fieldConfig;
                    fieldConfig.resolve = async (object, args, context, info) => {
                      if (isEmail) {
                        checkEmail(args[arg.name.value] || '');
                      }
                      if (notEmpty) {
                        checkNotEmpty(args[arg.name.value] || '');
                      }
                      return resolve(object, args, context, info);
                    };
                  }
                }
              })
            })
          }
          return fieldConfig
        }
      })
  }
}
