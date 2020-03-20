import { ForbiddenError, UserInputError } from 'apollo-server-express';
import { defaultFieldResolver } from 'graphql';
import { ResolverContextWithUser, UnknownGraphQLField, UnknownGraphQLResolverResult } from '../types/graphql';
import RequireAuthDirective from './requireAuthDirective';

/**
 * Defines directive for accessing to a field only to authorized users
 */
export default class RequireAdminDirective extends RequireAuthDirective {
  /**
   * Function to call on visiting field definition
   * @param field - field to access
   */
  public visitFieldDefinition(field: UnknownGraphQLField<ResolverContextWithUser>): UnknownGraphQLField | void | null {
    super.visitFieldDefinition(field as UnknownGraphQLField);

    const {
      resolve = defaultFieldResolver,
    } = field;

    /**
     * New field resolver
     * @param resolverArgs - default GraphQL resolver args
     */
    field.resolve = async function (...resolverArgs): UnknownGraphQLResolverResult {
      const [, args, context] = resolverArgs;

      const workspace = await context.factories.workspacesFactory.findById(args.workspaceId);

      if (!workspace) {
        throw new UserInputError('There is no workspace with that id');
      }

      const member = await workspace.getMemberInfo(context.user.id);

      if (!member) {
        throw new ForbiddenError('You are not in the workspace');
      }

      if (!member.isAdmin) {
        throw new ForbiddenError('Not enough permissions');
      }

      return resolve.apply(this, resolverArgs);
    };
  }
}
