import {
  SchemaDirectiveVisitor,
  AuthenticationError
} from 'apollo-server-express';
import {
  AccessTokenExpiredError
} from '../errors';
import { defaultFieldResolver, GraphQLField } from 'graphql';
import { ResolverContextBase } from '../types/graphql';

/**
 * Defines directive for accessing to a field only to authorized users
 */
export default class RequireAuthDirective extends SchemaDirectiveVisitor {
  /**
   * Authorizes the user or throws an error if the data is incorrect
   * @param context - request context
   */
  private static checkUser(context: ResolverContextBase): void {
    if (context.user && context.user.accessTokenExpired) {
      throw new AccessTokenExpiredError();
    }

    if (context.user && !context.user.id) {
      throw new AuthenticationError(
        'You must be signed in to view this resource.'
      );
    }
  }

  /**
   * Function to call on visiting field definition
   * @param field - field to access
   */
  public visitFieldDefinition(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    field: GraphQLField<any, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): GraphQLField<any, any> | void | null {
    const {
      resolve = defaultFieldResolver,
      subscribe,
    } = field;

    /**
     * New field resolver
     * @param resolverArgs - default GraphQL resolver args
     */
    field.resolve = async function (...resolverArgs): Promise<void> {
      const [, , context] = resolverArgs;

      RequireAuthDirective.checkUser(context);

      return resolve.apply(this, resolverArgs);
    };

    if (subscribe) {
      field.subscribe = async function (...resolverArgs): Promise<void> {
        const [, , context] = resolverArgs;

        RequireAuthDirective.checkUser(context);

        return subscribe.apply(this, resolverArgs);
      };
    }
  }
}
