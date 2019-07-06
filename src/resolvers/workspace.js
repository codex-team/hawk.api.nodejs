const { ApolloError } = require('apollo-server-express');
const Workspace = require('../models/workspace');
const Team = require('../models/team');
const Membership = require('../models/membership');
const User = require('../models/user');
const { ProjectToWorkspace } = require('../models/project');

/**
 * See all types and fields here {@see ../typeDefs/workspace.graphql}
 */
module.exports = {
  Query: {
    /**
     * Returns workspace(s) info by id(s)
     * Returns all user's workspaces if ids = []
     * @param {ResolverObj} _obj
     * @param {String[]} ids - workspace ids
     * @param {Context.user} user - current authorized user {@see ../index.js}
     * @return {Workspace[]}
     */
    async workspaces(_obj, { ids }, { user }) {
      try {
        const membership = new Membership(user.id);

        return membership.getWorkspaces(ids);
      } catch (err) {
        throw new ApolloError('Something went wrong');
      }
    }
  },
  Mutation: {
    /**
     * Create new workspace
     * @param {ResolverObj} _obj
     * @param {String} name - workspace name
     * @param {String} description - workspace description
     * @param {String} image - workspace image
     * @param {Context.user} user - current authorized user {@see ../index.js}
     * @return {String} created workspace id
     */
    async createWorkspace(_obj, { name, description, image }, { user }) {
      const ownerId = user.id;

      // @todo make workspace creation via transactions

      try {
        const workspace = await Workspace.create({
          name,
          description,
          image
        });

        const team = new Team(workspace.id);

        await team.addMember(ownerId);

        const membership = new Membership(ownerId);

        await membership.addWorkspace(workspace.id);

        return workspace;
      } catch (err) {
        throw new ApolloError('Something went wrong');
      }
    },

    async inviteToWorkspace(_obj, { userEmail, workspaceId }, { user }) {
      // @todo implement invitation confirmation by user
      const membership = new Membership(user.id);

      const [ workspace ] = await membership.getWorkspaces([ workspaceId ]);

      if (!workspace) throw new ApolloError('There is no workspace with that id');

      // @todo invite users to workspace, even if they are not registered
      const invitedUser = await User.findByEmail(userEmail);

      if (!invitedUser) throw new ApolloError('There is no user with that email');

      // @todo make via transactions
      await new Membership(invitedUser.id).addWorkspace(workspaceId);
      await new Team(workspaceId).addMember(invitedUser.id);

      return true;
    }
  },
  Workspace: {
    /**
     * Fetch workspaces users
     * @param {ResolverObj} rootResolverResult - result from resolver above
     * @return {Promise<User[]>}
     */
    async users(rootResolverResult) {
      const team = new Team(rootResolverResult.id);

      return team.getAllUsers();
    },

    /**
     * Fetch projects in workspace
     * @param {ResolverObj} rootResolverResult - result from resolver above
     * @param {String[]} ids - project ids
     * @returns {Promise<Project[]>}
     */
    async projects(rootResolverResult, { ids }) {
      const projectToWorkspace = new ProjectToWorkspace(rootResolverResult.id);

      return projectToWorkspace.getProjects(ids);
    }
  }
};
