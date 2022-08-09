import { BooleanValueNode, defaultFieldResolver, GraphQLSchema } from 'graphql';
import { mapSchema, MapperKind } from '@graphql-tools/utils';
import { UserInputError } from 'apollo-server-core';

/**
 * Validates string using regex
 *
 * @param email - string for validatation
 */
function checkEmail(email: string): void {
  const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/g;

  if (email.match(emailRegex) === null) {
    throw new UserInputError('Wrong email format');
  }
}

/**
 * Checks a string for void, replacing all spaces
 *
 * @param str - string for validation
 */
function checkNotEmpty(str: string): void {
  if (str.replace(/\s/g, '').length == 0) {
    throw new UserInputError('The value must not be empty');
  }
}

/**
 * Validation directive function return type
 */
interface ValidateDirectiveResult {
  /**
   * Type definition for directive
   */
  validateDirectiveTypeDefs: string;

  /**
   * Schema transformer for applying directive
   *
   * @param schema - schema to transform
   */
  validateDirectiveTransformer: (schema: GraphQLSchema) => GraphQLSchema
}

/**
 * Directive for arguments validation
 *
 * @param directiveName - directive name in the schema
 */
export default function validateDirective(directiveName = 'validate'): ValidateDirectiveResult {
  return {
    validateDirectiveTypeDefs:`
    """
    Directive for checking a field for empty space
    """
    directive @${directiveName}(notEmpty: Boolean, isEmail: Boolean) on ARGUMENT_DEFINITION
    `,
    validateDirectiveTransformer: (schema: GraphQLSchema) =>
      mapSchema(schema, {
        [MapperKind.MUTATION_ROOT_FIELD]: (fieldConfig) => {
          const fieldArgs = fieldConfig.astNode?.arguments;

          if (fieldArgs) {
            fieldArgs.forEach(arg => {
              const directives = arg.directives;

              directives?.forEach(directive => {
                if (directive.name.value === directiveName) {
                  const directiveArguments = directive.arguments;
                  const isEmail = (directiveArguments?.find(_arg => _arg.name.value === 'isEmail')?.value as BooleanValueNode)?.value;
                  const notEmpty = (directiveArguments?.find(_arg => _arg.name.value === 'notEmpty')?.value as BooleanValueNode)?.value;

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
              });
            });
          }

          return fieldConfig;
        },
      }),
  };
}
