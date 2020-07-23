import { SchemaDirectiveVisitor, ForbiddenError } from 'apollo-server-express';
import { defaultFieldResolver } from 'graphql';
import { ResolverContextBase, UnknownGraphQLField, UnknownGraphQLResolverResult } from '../types/graphql';

/**
 * Defines directive for accessing to a field only to users in this workspace by projectId or workspaceId
 */
export default class RequireUserInWorkspaceDirective extends SchemaDirectiveVisitor {
  /**
   * Get user info about this user in project workspace by projectId
   * Throw an error if it's has no any info
   *
   * @param context - request context
   * @param projectId - project id
   */
  private static async checkUserInWorkspaceByProjectId(context: ResolverContextBase, projectId: string): Promise<void> {
    const userId = context.user.id;

    if (userId) {
      const projectData = await context.factories.projectsFactory.findById(projectId);
      const workspaceId = projectData?.workspaceId.toString();

      if (!workspaceId) {
        RequireUserInWorkspaceDirective.throwError(new ForbiddenError('No workspace for this projectId'));

        return;
      }

      const workspace = await context.factories.workspacesFactory.findById(workspaceId);
      const workspaceMemberInfo = await workspace?.getMemberInfo(userId);

      if (!workspaceMemberInfo) {
        RequireUserInWorkspaceDirective.throwError(new ForbiddenError('You have no access to this workspace'));
      }
    }
  }

  /**
   * Get user info about this user in workspace by workspaceId
   * Throw an error if it's has no any info
   *
   * @param context - request context
   * @param workspaceId - workspace id
   */
  private static async checkUserInWorkspaceByWorkspaceId(context: ResolverContextBase, workspaceId: string): Promise<void> {
    const userId = context.user.id;

    if (userId) {
      const workspace = await context.factories.workspacesFactory.findById(workspaceId);
      const workspaceMemberInfo = await workspace?.getMemberInfo(userId);

      if (!workspaceMemberInfo) {
        RequireUserInWorkspaceDirective.throwError(new ForbiddenError('You have no access to this workspace'));
      }
    }
  }

  /**
   * Throw error from sync function
   */
  private static throwError(error: Error): void {
    throw error;
  }

  /**
   * Function to call on visiting field definition
   *
   * @param field - field to access
   */
  public visitFieldDefinition(field: UnknownGraphQLField): void {
    const { resolve = defaultFieldResolver } = field;

    /**
     * New field resolver
     *
     * @param resolverArgs - default GraphQL resolver args
     */
    field.resolve = async function (...resolverArgs): UnknownGraphQLResolverResult {
      const [, args, context] = resolverArgs;

      if (args.workspaceId) {
        await RequireUserInWorkspaceDirective.checkUserInWorkspaceByWorkspaceId(context, args.workspaceId);
      } else if (args.projectId) {
        await RequireUserInWorkspaceDirective.checkUserInWorkspaceByProjectId(context, args.projectId);
      } else if (args.input?.projectId) {
        await RequireUserInWorkspaceDirective.checkUserInWorkspaceByProjectId(context, args.input.projectId);
      } else if (args.input?.workspaceId) {
        await RequireUserInWorkspaceDirective.checkUserInWorkspaceByWorkspaceId(context, args.input.workspaceId);
      }

      return resolve.apply(this, resolverArgs);
    };
  }
}
