const { ApolloError, UserInputError } = require('apollo-server-express');
const crypto = require('crypto');

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
     * @param {ResolverObj} _obj - object that contains the result returned from the resolver on the parent field
     * @param {String[]} ids - workspace ids
     * @param {UserInContext} user - current authorized user {@see ../index.js}
     * @param {ContextFactories} factories - factories for working with models
     * @return {Workspace[]}
     */
    async workspaces(_obj, { ids }, { user, factories }) {
      const authenticatedUser = await factories.usersFactory.findById(user.id);

      return factories.workspacesFactory.findManyByIds(await authenticatedUser.getWorkspacesIds(ids));
    },
  },
  Mutation: {
    /**
     * Create new workspace
     * @param {ResolverObj} _obj - object that contains the result returned from the resolver on the parent field
     * @param {String} name - workspace name
     * @param {String} description - workspace description
     * @param {string} image - workspace image
     * @param {UserInContext} user - current authorized user {@see ../index.js}
     * @param {ContextFactories} factories - factories for working with models
     *
     * @return {String} created workspace id
     */
    async createWorkspace(_obj, { name, description, image }, { user, factories }) {
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

        /**
         * @type {WorkspaceDBScheme}
         */
        const options = {
          name,
          // balance: 0,
          description,
          image,
          // plan
        };

        const ownerModel = await factories.usersFactory.findById(user.id);

        return await factories.workspacesFactory.create(options, ownerModel);
      } catch (err) {
        console.log('\nლ(´ڡ`ლ) Error [resolvers:workspace:createWorkspace]: \n\n', err, '\n\n');
        throw new ApolloError('Something went wrong');
      }
    },

    /**
     * Invite user to workspace
     * @param {ResolverObj} _obj - object that contains the result returned from the resolver on the parent field
     * @param {String} userEmail - email of the user to invite
     * @param {string} workspaceId - id of the workspace to which the user is invited
     * @param {UserInContext} user - current authorized user {@see ../index.js}
     * @param {ContextFactories} factories - factories for working with models
     * @return {Promise<boolean>} - true if operation is successful
     */
    async inviteToWorkspace(_obj, { userEmail, workspaceId }, { user, factories }) {
      const userModel = await factories.usersFactory.findById(user.id);
      const [ isWorkspaceBelongsToUser ] = await userModel.getWorkspacesIds([ workspaceId ]);

      if (!isWorkspaceBelongsToUser) {
        throw new ApolloError('There is no workspace with that id');
      }

      const invitedUser = await factories.usersFactory.findByEmail(userEmail);
      const workspace = await factories.workspacesFactory.findById(workspaceId);

      if (!invitedUser) {
        await workspace.addUnregisteredMember(userEmail);
      } else {
        const [ isUserInThatWorkspace ] = await invitedUser.getWorkspacesIds([ workspaceId ]);

        if (isUserInThatWorkspace) {
          throw new ApolloError('User already invited to this workspace');
        }

        await invitedUser.addWorkspace(workspaceId, true);
        await workspace.addMember(invitedUser._id.toString(), true);
      }

      const linkHash = crypto
        .createHash('sha256')
        .update(`${workspaceId}:${userEmail}:${process.env.HASH_SALT}`)
        .digest('hex');

      const inviteLink = `${process.env.GARAGE_URL}/join/${workspaceId}/${linkHash}`;

      emailProvider.send(userEmail, emailTemplatesNames.WORKSPACE_INVITE, {
        name: workspace.name,
        inviteLink,
      });

      return true;
    },

    /**
     * Confirm user invitation
     *
     * @param {ResolverObj} _obj - object that contains the result returned from the resolver on the parent field
     * @param {String} inviteHash - hash passed to the invite link
     * @param {string} workspaceId - id of the workspace to which the user is invited
     * @param {UserInContext} user - current authorized user {@see ../index.js}
     * @param {ContextFactories} factories - factories for working with models
     * @return {Promise<boolean>} - true if operation is successful
     */
    async confirmInvitation(_obj, { inviteHash, workspaceId }, { user, factories }) {
      const currentUser = await factories.usersFactory.findById(user.id);

      let membershipExists;
      const workspace = await factories.workspacesFactory.findById(workspaceId);

      if (inviteHash) {
        const hash = crypto
          .createHash('sha256')
          .update(`${workspaceId}:${currentUser.email}:${process.env.HASH_SALT}`)
          .digest('hex');

        if (hash !== inviteHash) {
          throw new ApolloError('The link is broken');
        }

        membershipExists = await workspace.confirmMembership(currentUser);
      } else {
        // @todo check if workspace allows invitations through general link

        if (await workspace.getMemberInfo(user.id)) {
          throw new ApolloError('You are already member of this workspace');
        }

        await workspace.addMember(currentUser._id.toString());

        membershipExists = false;
      }

      const userModel = await factories.usersFactory.findById(user.id);

      if (membershipExists) {
        await userModel.confirmMembership(workspaceId);
      } else {
        await userModel.addWorkspace(workspaceId);
      }

      return true;
    },

    /**
     * Update workspace settings
     *
     * @param {ResolverObj} _obj - object that contains the result returned from the resolver on the parent field
     * @param {string} workspaceId - id of the updated workspace
     * @param {string} name - workspace name
     * @param {string} description - workspace description
     * @param {string} image - workspace logo
     * @param {UserInContext} user - current authorized user {@see ../index.js}
     * @param {ContextFactories} factories - factories for working with models
     *
     * @returns {Promise<Boolean>}
     */
    async updateWorkspace(_obj, { id, name, description, image }, { user, factories }) {
      // @makeAnIssue Create directives for arguments validation
      if (!Validator.string(name)) {
        throw new UserInputError('Invalid name length');
      }

      if (!Validator.string(description, 0)) {
        throw new UserInputError('Invalid description length');
      }

      const userModel = await factories.usersFactory.findById(user.id);

      const [ workspaceId ] = await userModel.getWorkspacesIds([ id ]);

      if (!workspaceId) {
        throw new ApolloError('There is no workspace with that id');
      }

      try {
        /**
         * @type {WorkspaceDBScheme}
         */
        const options = {
          name,
          description,
          image,
        };

        const workspaceToUpdate = await factories.workspacesFactory.findById(workspaceId);

        await workspaceToUpdate.updateWorkspace(options);
      } catch (err) {
        throw new ApolloError('Something went wrong');
      }

      return true;
    },

    /**
     * Grant admin permissions
     *
     * @param {ResolverObj} _obj - object that contains the result returned from the resolver on the parent field
     * @param {string} workspaceId - id of the workspace
     * @param {string} userId - id of user to grant permissions
     * @param {boolean} state - state of permissions (true to grant, false to withdraw)
     * @param {UserInContext} user - current authorized user {@see ../index.js}
     * @param {ContextFactories} factories - factories for working with models
     * @return {Promise<boolean>} - true if operation is successful
     */
    async grantAdmin(_obj, { workspaceId, userId, state }, { user, factories }) {
      const workspace = await factories.workspacesFactory.findById(workspaceId);
      const member = await workspace.getMemberInfo(user.id);

      if (!member) {
        throw new ApolloError('You are not in the workspace');
      }

      if (!member.isAdmin) {
        throw new ApolloError('Not enough permissions');
      }

      await workspace.grantAdmin(userId, state);

      return true;
    },

    /**
     * Remove user from workspace
     *
     * @param {ResolverObj} _obj - object that contains the result returned from the resolver on the parent field
     * @param {string} workspaceId - id of the workspace where the user should be removed
     * @param {string} userId - id of user to remove
     * @param {string} userEmail - email of user to remove
     * @param {UserInContext} user - current authorized user {@see ../index.js}
     * @param {ContextFactories} factories - factories for working with models
     * @return {Promise<boolean>} - true if operation is successful
     * @returns {Promise<boolean>}
     */
    async removeMemberFromWorkspace(_obj, { workspaceId, userId, userEmail }, { user, factories }) {
      const workspace = await factories.workspacesFactory.findById(workspaceId);

      const member = await workspace.getMemberInfo(user.id);

      if (!member) {
        throw new ApolloError('You are not in the workspace');
      }

      if (!member.isAdmin) {
        throw new ApolloError('Not enough permissions');
      }

      const userModel = await factories.usersFactory.findById(userId);

      if (userId) {
        await workspace.removeMember(userModel);
      } else {
        await workspace.removeMemberByEmail(userEmail);
      }

      return true;
    },
  },
  Workspace: {
    /**
     * Fetch workspaces users
     * @param {WorkspaceDBScheme} rootResolverResult - result from resolver above
     * @param _args - empty list of args
     * @param {ContextFactories} factories - factories for working with models
     */
    async users(rootResolverResult, _args, { factories }) {
      const workspace = await factories.workspacesFactory.findById(rootResolverResult._id.toString());

      const members = await workspace.getTeam();

      return Promise.all(members.map(async member => {
        return {
          ...member,
          ...await factories.usersFactory.findById(member.userId.toString()),
        };
      }));
    },

    /**
     * Fetch pending users
     * @param {WorkspaceDBScheme} rootResolverResult - result from resolver above
     * @param _args - empty list of args
     * @param {ContextFactories} factories - factories for working with models
     */
    async pendingUsers(rootResolverResult, _args, { factories }) {
      const workspace = await factories.workspacesFactory.findById(rootResolverResult._id.toString());

      const pendingMembers = await workspace.getPendingMembersInfo();

      /**
       * @makeAnIssue @todo improve member info scheme
       */
      return Promise.all(pendingMembers.map(async member => {
        return {
          ...member,
          ...await factories.usersFactory.findById(member.userId.toString()),
        };
      }));
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
    },
  },
};
