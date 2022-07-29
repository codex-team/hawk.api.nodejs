import { ForbiddenError, UserInputError } from 'apollo-server-express';
import { defaultFieldResolver } from 'graphql';
import { ResolverContextWithUser, UnknownGraphQLField, UnknownGraphQLResolverResult } from '../types/graphql';
import RequireAuthDirective from './requireAuthDirective';
import WorkspaceModel from '../models/workspace';

/**
 * Defines directive for accessing to a field only for admins
 *
 * Order to check workspace or project id:
 * 1) args.workspaceId
 * 2) args.input.workspaceId
 * 3) args.projectId
 * 4) args.input.projectId
 */
export default class RequireAdminDirective extends RequireAuthDirective {
  /**
   * Check is user admin via workspace id
   * @param context - resolver context
   * @param workspaceId - workspace id to check
   */
  private static async checkByWorkspaceId(context: ResolverContextWithUser, workspaceId: string): Promise<void> {
    const workspace = await context.factories.workspacesFactory.findById(workspaceId);

    if (!workspace) {
      throw new UserInputError('There is no workspace with that id');
    }

    const member = await workspace.getMemberInfo(context.user.id);

    if (!member || WorkspaceModel.isPendingMember(member)) {
      throw new ForbiddenError('You are not a member of this workspace');
    }

    if (!member.isAdmin) {
      throw new ForbiddenError('Not enough permissions');
    }
  }

  /**
   * Check is user admin via project id
   * @param context - resolver context
   * @param projectId - project id to check
   */
  private static async checkByProjectId(context: ResolverContextWithUser, projectId: string): Promise<void> {
    const project = await context.factories.projectsFactory.findById(projectId);

    if (!project) {
      throw new UserInputError('There is no project with provided ID');
    }

    await RequireAdminDirective.checkByWorkspaceId(context, project.workspaceId.toString());
  }

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
    field.resolve = async (...resolverArgs): UnknownGraphQLResolverResult => {
      const [, args, context] = resolverArgs;

      if (args.workspaceId) {
        await RequireAdminDirective.checkByWorkspaceId(context, args.workspaceId);
      }

      if (args.input?.projectId) {
        await RequireAdminDirective.checkByProjectId(context, args.input.projectId);
      }

      return resolve.apply(this, resolverArgs);
    };
  }
}
