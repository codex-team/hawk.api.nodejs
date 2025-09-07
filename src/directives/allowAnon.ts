import { defaultFieldResolver, GraphQLSchema } from 'graphql';
import { mapSchema, MapperKind, getDirective } from '@graphql-tools/utils';
import { ResolverContextBase, UnknownGraphQLResolverResult } from '../types/graphql';
import { AccessTokenExpiredError } from '../errors';
import { AuthenticationError } from 'apollo-server-express';

/**
 * Authorizes the user or throws an error if the data is incorrect
 * @param context - request context
 */
function checkUser(context: ResolverContextBase): void {
  if (context.user && context.user.accessTokenExpired) {
    throw new AccessTokenExpiredError();
  }

  if (context.user && !context.user.id) {
    throw new AuthenticationError(
      'You must be signed in to view this resource.'
    );
  }
}

export default function allowAnonDirective(directiveName = 'allowAnon') {
  return {
    allowAnonDirectiveTypeDefs: `
    """
    Allow access to the field to anonymous users
    """
    directive @${directiveName} on FIELD_DEFINITION
    `,
    allowAnonDirectiveTransformer: (schema: GraphQLSchema) =>
      mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName) => {
          const allowAnonDirective = getDirective(schema, fieldConfig, directiveName)?.[0];

          if (allowAnonDirective) {
            /** Append flag isAnonAllowed to request context */
            const {
              resolve = defaultFieldResolver,
            } = fieldConfig;

            fieldConfig.resolve = async function (...resolverArgs): UnknownGraphQLResolverResult {
              const [, , context] = resolverArgs;

              context.isAnonAllowed = true;
              return resolve.apply(this, resolverArgs);
            };

            return fieldConfig;
          }

          const {
            resolve = defaultFieldResolver,
          } = fieldConfig;

          fieldConfig.resolve = async function (...resolverArgs): UnknownGraphQLResolverResult {
            const [, , context] = resolverArgs;

            if (!context.isAnonAllowed) {
              checkUser(context);
            }

            return resolve.apply(this, resolverArgs);
          };

          return fieldConfig;
        },
      }),
  };
}
