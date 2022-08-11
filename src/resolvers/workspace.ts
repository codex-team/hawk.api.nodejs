import type { QueryResolvers } from '../types/schema.js';
import ensureAuthedUser from '../lib/ensure-authed-user.js';
import WorkspaceModel from '../models/workspace.js';

const Query: QueryResolvers = {
  allWorkspaces: async (_, __, ctx) => {
    const userId = ensureAuthedUser(ctx.user);

    console.log(userId);

    return WorkspaceModel.findAllByUserId(userId, true);
  },
};

const workspaceResolvers = {
  Query,
};

export default workspaceResolvers;
