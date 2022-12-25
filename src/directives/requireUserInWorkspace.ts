import {defaultFieldResolver, GraphQLSchema} from "graphql";
import {mapSchema, MapperKind, getDirective} from '@graphql-tools/utils'
import {ResolverContextBase, UnknownGraphQLResolverResult} from "../types/graphql";
import {ForbiddenError} from "apollo-server-express";

/**
 * Throw error from sync function
 */
function throwError(error: Error): void {
  throw error;
}

/**
 * Get user info about this user in workspace by workspaceId
 * Throw an error if it's has no any info
 *
 * @param context - request context
 * @param workspaceId - workspace id
 */
async function checkUserInWorkspaceByWorkspaceId(context: ResolverContextBase, workspaceId: string): Promise<void> {
  const userId = context.user.id;

  if (userId) {
    const workspace = await context.factories.workspacesFactory.findById(workspaceId);
    const workspaceMemberInfo = await workspace?.getMemberInfo(userId);

    if (!workspaceMemberInfo) {
      throwError(new ForbiddenError('You have no access to this workspace'));
    }
  }
}

/**
 * Get user info about this user in project workspace by projectId
 * Throw an error if it's has no any info
 *
 * @param context - request context
 * @param projectId - project id
 */
async function checkUserInWorkspaceByProjectId(context: ResolverContextBase, projectId: string): Promise<void> {
  const userId = context.user.id;

  if (userId) {
    const projectData = await context.factories.projectsFactory.findById(projectId);
    const workspaceId = projectData?.workspaceId.toString();

    if (!workspaceId) {
      throwError(new ForbiddenError('No workspace for this projectId'));

      return;
    }

    const workspace = await context.factories.workspacesFactory.findById(workspaceId);
    const workspaceMemberInfo = await workspace?.getMemberInfo(userId);

    if (!workspaceMemberInfo) {
      throwError(new ForbiddenError('You have no access to this workspace'));
    }
  }
}


export default function requireUserInWorkspaceDirective(directiveName = 'requireUserInWorkspace') {
  return {
    requireUserInWorkspaceDirectiveTypeDefs:`
    """
    Directive for checking user in workspace
    """
    directive @${directiveName} on FIELD_DEFINITION
    `,
    requireUserInWorkspaceDirectiveTransformer: (schema: GraphQLSchema) =>
      mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName) => {
          const requireUserInWorkspaceDirective = getDirective(schema, fieldConfig, directiveName)?.[0];

          if (requireUserInWorkspaceDirective) {
            const { resolve = defaultFieldResolver } = fieldConfig;

            /**
             * New field resolver
             *
             * @param resolverArgs - default GraphQL resolver args
             */
            fieldConfig.resolve = async function (...resolverArgs): UnknownGraphQLResolverResult {
              const [, args, context] = resolverArgs;

              if (args.workspaceId) {
                await checkUserInWorkspaceByWorkspaceId(context, args.workspaceId);
              } else if (args.projectId) {
                await checkUserInWorkspaceByProjectId(context, args.projectId);
              } else if (args.input?.projectId) {
                await checkUserInWorkspaceByProjectId(context, args.input.projectId);
              } else if (args.input?.workspaceId) {
                await checkUserInWorkspaceByWorkspaceId(context, args.input.workspaceId);
              }

              return resolve.apply(this, resolverArgs);
            };
          }
          return fieldConfig;
        }
      })
  }
}
