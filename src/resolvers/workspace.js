const { ApolloError, UserInputError } = require('apollo-server-express');
const crypto = require('crypto');

const Workspace = require('../models/workspace');
const Team = require('../models/team');
const Membership = require('../models/membership');
const User = require('../models/user').default;
// const Plan = require('../models/plan');
const { ProjectToWorkspace } = require('../models/project');
const Validator = require('../utils/validator');
const emailProvider = require('../email');
const { names: emailTemplatesNames } = require('../email/templates');

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
        /**
         * @since 2019-12-11 - Remove default Plan saving to fix workspace creation with empty DB
         * @todo check for defaultPlan existence before access defaultPlan.name
         *       or create default plane on app initialization
         */
        /*
         * const defaultPlan = await Plan.getDefaultPlan();
         * const plan = {
         *   subscriptionDate: Date.now() / 1000,
         *   lastChargeDate: Date.now() / 1000,
         *   name: defaultPlan.name
         * };
         */
        const workspace = await Workspace.create({
          name,
          balance: 0,
          description,
          image
          // plan
        });

        const team = new Team(workspace.id);

        await team.addMember(ownerId);
        await team.grantAdmin(ownerId);

        const membership = new Membership(ownerId);

        await membership.addWorkspace(workspace.id);

        return workspace;
      } catch (err) {
        console.log('\nლ(´ڡ`ლ) Error [resolvers:workspace:createWorkspace]: \n\n', err, '\n\n');
        throw new ApolloError('Something went wrong');
      }
    },

    /**
     * Invite user to workspace
     * @param {ResolverObj} _obj
     * @param {String} userEmail - email of the user to invite
     * @param {Workspace.id} workspaceId - id of the workspace to which the user is invited
     * @param {Context.user} user - current authorized user {@see ../index.js}
     * @return {Promise<boolean>} - true if operation is successful
     */
    async inviteToWorkspace(_obj, { userEmail, workspaceId }, { user }) {
      const [ workspace ] = await new Membership(user.id).getWorkspaces([ workspaceId ]);

      if (!workspace) throw new ApolloError('There is no workspace with that id');

      // @todo invite users to workspace, even if they are not registered
      const invitedUser = await User.findByEmail(userEmail);

      if (!invitedUser) {
        await new Team(workspaceId).addUnregisteredMember(userEmail);
      } else {
        const [ isUserInThatWorkspace ] = await new Membership(invitedUser._id).getWorkspaces([ workspaceId ]);

        if (isUserInThatWorkspace) throw new ApolloError('User already invited to this workspace');

        // @todo make via transactions
        await new Membership(invitedUser._id).addWorkspace(workspaceId, true);
        await new Team(workspaceId).addMember(invitedUser._id, true);
      }

      const linkHash = crypto
        .createHash('sha256')
        .update(`${workspaceId}:${userEmail}:${process.env.HASH_SALT}`)
        .digest('hex');

      const inviteLink = `${process.env.GARAGE_URL}/join/${workspaceId}/${linkHash}`;

      emailProvider.send(userEmail, emailTemplatesNames.WORKSPACE_INVITE, {
        name: workspace.name,
        inviteLink
      });

      return true;
    },

    /**
     * Confirm user invitation
     *
     * @param {ResolverObj} _obj
     * @param {String} inviteHash - hash passed to the invite link
     * @param {Workspace.id} workspaceId - id of the workspace to which the user is invited
     * @param {Context.user} user - current authorized user {@see ../index.js}
     * @return {Promise<boolean>} - true if operation is successful
     */
    async confirmInvitation(_obj, { inviteHash, workspaceId }, { user }) {
      const currentUser = await User.findById(user.id);

      let membershipExists;

      if (inviteHash) {
        const hash = crypto
          .createHash('sha256')
          .update(`${workspaceId}:${currentUser.email}:${process.env.HASH_SALT}`)
          .digest('hex');

        if (hash !== inviteHash) throw new ApolloError('The link is broken');

        membershipExists = await new Team(workspaceId).confirmMembership(currentUser);
      } else {
        // @todo check if workspace allows invitations through general link

        const team = new Team(workspaceId);
        const members = await team.getAllUsers();

        if (members.find(m => m._id.toString() === currentUser._id.toString())) {
          throw new ApolloError('You are already member of this workspace');
        }

        await team.addMember(currentUser._id);

        membershipExists = false;
      }

      if (membershipExists) {
        await new Membership(user.id).confirmMembership(workspaceId);
      } else {
        await new Membership(user.id).addWorkspace(workspaceId);
      }

      return true;
    },

    /**
     * Update workspace settings
     *
     * @param {ResolverObj} _obj
     * @param {string} workspaceId - id of the updated workspace
     * @param {string} name - workspace name
     * @param {string} description - workspace description
     * @param {Context.user} user - current authorized user
     * @returns {Promise<Boolean>}
     */
    async updateWorkspace(_obj, { id, name, description }, { user }) {
      // @makeAnIssue Create directives for arguments validation
      if (!Validator.string(name)) throw new UserInputError('Invalid name length');
      if (!Validator.string(description, 0)) throw new UserInputError('Invalid description length');

      const [ workspace ] = await new Membership(user.id).getWorkspaces([ id ]);

      if (!workspace) {
        throw new ApolloError('There is no workspace with that id');
      }

      try {
        await Workspace.updateWorkspace(workspace.id, { name, description });
      } catch (err) {
        throw new ApolloError('Something went wrong');
      }

      return true;
    },

    /**
     * Grant admin permissions
     *
     * @param {ResolverObj} _obj
     * @param {Workspace.id} workspaceId - id of the workspace
     * @param {User.id} userId - id of user to grant permissions
     * @param {boolean} state - state of permissions (true to grant, false to withdraw)
     * @param {Context.user} user - current authorized user {@see ../index.js}
     * @return {Promise<boolean>} - true if operation is successful
     */
    async grantAdmin(_obj, { workspaceId, userId, state }, { user }) {
      const team = new Team(workspaceId);
      const users = await team.getAllUsers();
      const member = users.find(el => el._id.toString() === user.id);

      if (!member) {
        throw new ApolloError('You are not in the workspace');
      }

      if (!member.isAdmin) {
        throw new ApolloError('Not enough permissions');
      }

      await team.grantAdmin(userId, state);

      return true;
    },

    /**
     * Remove user from workspace
     *
     * @param {ResolverObj} _obj
     * @param {Workspace.id} workspaceId - id of the workspace where the user should be removed
     * @param {User.id} userId - id of user to remove
     * @param {User.email} userEmail - email of user to remove
     * @param {Context.user} user - current authorized user {@see ../index.js}
     * @return {Promise<boolean>} - true if operation is successful
     * @returns {Promise<boolean>}
     */
    async removeMemberFromWorkspace(_obj, { workspaceId, userId, userEmail }, { user }) {
      const team = new Team(workspaceId);

      const users = await team.getAllUsers();

      const member = users.find(el => el._id.toString() === user.id);

      if (!member) {
        throw new ApolloError('You are not in the workspace');
      }

      if (!member.isAdmin) {
        throw new ApolloError('Not enough permissions');
      }

      if (userId) {
        const membership = new Membership(userId);

        await team.removeMember(userId);
        await membership.removeWorkspace(workspaceId);
      } else {
        await team.removeMemberByEmail(userEmail);
      }

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
     * Fetch pending users
     * @param {ResolverObj} rootResolverResult - result from resolver above
     * @return {Promise<User[]>}
     */
    async pendingUsers(rootResolverResult) {
      const team = new Team(rootResolverResult.id);

      return team.getPendingUsers();
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
