import {defaultFieldResolver, GraphQLSchema} from "graphql";
import {mapSchema, MapperKind, getDirective} from '@graphql-tools/utils'
import {ResolverContextBase, UnknownGraphQLResolverResult} from "../types/graphql";
import {AccessTokenExpiredError} from "../errors";
import {AuthenticationError} from "apollo-server-express";

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


export default function requireAuthDirective(directiveName = 'requireAuth') {
  return {
    requireAuthDirectiveTypeDefs: `
    """
    Access to the field only to authorized users
    """
    directive @${directiveName} on FIELD_DEFINITION
    `,
    requireAuthDirectiveTransformer: (schema: GraphQLSchema) =>
      mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName) => {
          const requireAuthDirective = getDirective(schema, fieldConfig, directiveName)?.[0];

          if (requireAuthDirective) {
            const {
              resolve = defaultFieldResolver,
            } = fieldConfig;

            /**
             * New field resolver
             * @param resolverArgs - default GraphQL resolver args
             */
            fieldConfig.resolve = async function (...resolverArgs): UnknownGraphQLResolverResult {
              const [, , context] = resolverArgs;

              checkUser(context);

              return resolve.apply(this, resolverArgs);
            };
          }
          return fieldConfig;
        }
      })
  }
}
