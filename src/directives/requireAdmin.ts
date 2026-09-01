import { defaultFieldResolver, GraphQLSchema } from 'graphql';
import { mapSchema, MapperKind, getDirective } from '@graphql-tools/utils';
import { ResolverContextWithUser, UnknownGraphQLResolverResult } from '../types/graphql';
import { ForbiddenError, UserInputError } from 'apollo-server-express';
import WorkspaceModel from '../models/workspace';

/**
 * Check is user admin via workspace id
 * @param context - resolver context
 * @param workspaceId - workspace id to check
 */
async function checkByWorkspaceId(context: ResolverContextWithUser, workspaceId: string): Promise<void> {
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
async function checkByProjectId(context: ResolverContextWithUser, projectId: string): Promise<void> {
  const project = await context.factories.projectsFactory.findById(projectId);

  if (!project) {
    throw new UserInputError('There is no project with provided ID');
  }

  await checkByWorkspaceId(context, project.workspaceId.toString());
}

/**
 * Defines directive for accessing to a field only for admins
 *
 * Order to check workspace or project id:
 * 1) args.workspaceId
 * 2) args.input.workspaceId
 * 3) args.projectId
 * 4) args.input.projectId
 */
export default function requireAdminDirective(directiveName = 'requireAdmin') {
  return {
    requireAdminDirectiveTypeDefs: `
    """
    Access to the field only for admins
    """
    directive @${directiveName} on FIELD_DEFINITION
    `,
    requireAdminDirectiveTransformer: (schema: GraphQLSchema) =>
      mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName) => {
          const requireAdminDirective = getDirective(schema, fieldConfig, directiveName)?.[0];

          if (requireAdminDirective) {
            const {
              resolve = defaultFieldResolver,
            } = fieldConfig;

            /**
             * New field resolver
             * @param resolverArgs - default GraphQL resolver args
             */
            fieldConfig.resolve = async (...resolverArgs): UnknownGraphQLResolverResult => {
              const [, args, context] = resolverArgs;

              if (args.workspaceId) {
                await checkByWorkspaceId(context, args.workspaceId);
              }

              if (args.input?.projectId) {
                await checkByProjectId(context, args.input.projectId);
              }

              return resolve(...resolverArgs);
            };
          }

          return fieldConfig;
        },
      }),
  };
}
