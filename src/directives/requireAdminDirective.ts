import { SchemaDirectiveVisitor, ForbiddenError } from 'apollo-server-express';
import { defaultFieldResolver, GraphQLField } from 'graphql';
import { ResolverContextBase } from '../types/graphql';

/**
 * Defines directive for accessing to a field only to authorized users
 */
export default class RequireAdminDirective extends SchemaDirectiveVisitor {
  /**
   * @param {GraphQLField<*,*>} field - field to access
   */
  public visitFieldDefinition(field: GraphQLField<any, any>): GraphQLField<any, any> | void | null {
    const {
      resolve = defaultFieldResolver,
    } = field;

    /**
     * New field resolver
     * @param {Array} resolverArgs - default GraphQL resolver args
     */
    field.resolve = async function (...resolverArgs: [object, Record<string, any>, ResolverContextBase]): Promise<any> {
      const [, args, context] = resolverArgs;

      const workspace = await context.factories.workspacesFactory.findById(args.workspaceId);

      if (!workspace) {
        const member = await workspace.getMemberInfo(context.user.id);
      }

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
