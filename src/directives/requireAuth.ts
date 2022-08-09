import { defaultFieldResolver, GraphQLSchema } from 'graphql';
import { mapSchema, MapperKind, getDirective } from '@graphql-tools/utils';
import type { ResolverContextBase } from '../types/graphql.js';
import { AuthenticationError } from 'apollo-server-core';

/**
 * Authorizes the user or throws an error if the data is incorrect
 *
 * @param context - request context
 */
function checkUser(context: ResolverContextBase): void {
  if (context.user && context.user.accessTokenExpired) {
    throw new AuthenticationError('Access token expired');
  }

  if (context.user && !context.user.id) {
    throw new AuthenticationError(
      'You must be signed in to view this resource.'
    );
  }
}

/**
 * Validation directive function return type
 */
interface RequireAuthDirectiveResult {
  /**
   * Type definition for directive
   */
  requireAuthDirectiveTypeDefs: string;

  /**
   * Schema transformer for applying directive
   *
   * @param schema - schema to transform
   */
  requireAuthDirectiveTransformer: (schema: GraphQLSchema) => GraphQLSchema
}

/**
 * RequireAuth directive for checking if the user is authorized
 *
 * @param directiveName - directive name in the schema
 */
export default function requireAuthDirective(directiveName = 'requireAuth'): RequireAuthDirectiveResult {
  return {
    requireAuthDirectiveTypeDefs: `
    """
    Access to the field only to authorized users
    """
    directive @${directiveName} on FIELD_DEFINITION
    `,
    requireAuthDirectiveTransformer: (schema: GraphQLSchema) =>
      mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
          const directive = getDirective(schema, fieldConfig, directiveName)?.[0];

          if (directive) {
            const {
              resolve = defaultFieldResolver,
            } = fieldConfig;

            /**
             * New field resolver
             *
             * @param resolverArgs - default GraphQL resolver args
             */
            fieldConfig.resolve = async function (...resolverArgs) {
              const [, , context] = resolverArgs;

              checkUser(context);

              return resolve(...resolverArgs);
            };
          }

          return fieldConfig;
        },
      }),
  };
}
