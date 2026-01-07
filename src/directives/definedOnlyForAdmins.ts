import { defaultFieldResolver, GraphQLSchema } from 'graphql';
import { mapSchema, MapperKind, getDirective } from '@graphql-tools/utils';
import { ResolverContextWithUser, UnknownGraphQLResolverResult } from '../types/graphql';
import { ForbiddenError, UserInputError } from 'apollo-server-express';
import WorkspaceModel from '../models/workspace';

/**
 * Check if user is admin of workspace
 * @param context - resolver context
 * @param workspaceId - workspace id to check
 * @returns true if user is admin, false otherwise
 */
async function isUserAdminOfWorkspace(context: ResolverContextWithUser, workspaceId: string): Promise<boolean> {
  try {
    const workspace = await context.factories.workspacesFactory.findById(workspaceId);

    if (!workspace) {
      return false;
    }

    const member = await workspace.getMemberInfo(context.user.id);

    if (!member || WorkspaceModel.isPendingMember(member)) {
      return false;
    }

    return member.isAdmin || false;
  } catch {
    return false;
  }
}

/**
 * Defines directive for fields that are only defined for admins
 * Returns null for non-admin users instead of throwing error
 *
 * Works with object fields where parent object has _id field (workspace id)
 *
 * Usage:
 * type Workspace {
 *   sso: WorkspaceSsoConfig @definedOnlyForAdmins
 * }
 */
export default function definedOnlyForAdminsDirective(directiveName = 'definedOnlyForAdmins') {
  return {
    definedOnlyForAdminsDirectiveTypeDefs: `
    """
    Field is only defined for admins. Returns null for non-admin users.
    Works with object fields where parent object has _id field (workspace id).
    """
    directive @${directiveName} on FIELD_DEFINITION
    `,
    definedOnlyForAdminsDirectiveTransformer: (schema: GraphQLSchema) =>
      mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName, typeName) => {
          const definedOnlyForAdminsDirective = getDirective(schema, fieldConfig, directiveName)?.[0];

          if (definedOnlyForAdminsDirective) {
            const {
              resolve = defaultFieldResolver,
            } = fieldConfig;

            /**
             * New field resolver that checks admin rights
             * @param resolverArgs - default GraphQL resolver args
             */
            fieldConfig.resolve = async (...resolverArgs): UnknownGraphQLResolverResult => {
              const [parent, , context] = resolverArgs;

              /**
               * Get workspace ID from parent object
               * Parent should have _id field (workspace)
               */
              if (!parent || !parent._id) {
                return null;
              }

              const workspaceId = parent._id.toString();

              /**
               * Check if user is admin
               */
              const isAdmin = await isUserAdminOfWorkspace(context, workspaceId);

              if (!isAdmin) {
                return null;
              }

              /**
               * Call original resolver
               */
              return resolve(...resolverArgs);
            };
          }

          return fieldConfig;
        },
      }),
  };
}

