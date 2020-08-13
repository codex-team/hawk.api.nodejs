import WorkspaceModel from '../models/workspace';
import { AccountType, Currency } from '../accounting/types';
import PlanModel from '../models/plan';

const { ApolloError, UserInputError, ForbiddenError } = require('apollo-server-express');
const crypto = require('crypto');

const ProjectToWorkspace = require('../models/projectToWorkspace');
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
     * @param {Accounting} accounting - SDK for creating account for new workspace
     *
     * @return {String} created workspace id
     */
    async createWorkspace(_obj, { name, description, image }, { user, factories, accounting }) {
      try {
        // Create workspace account and set account id to workspace
        const accountResponse = await accounting.createAccount({
          name: name,
          type: AccountType.LIABILITY,
          currency: Currency.USD,
        });

        const accountId = accountResponse.recordId;

        /**
         * @type {WorkspaceDBScheme}
         */
        const options = {
          name,
          description,
          image,
          accountId,
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
    async updateWorkspace(_obj, { workspaceId, name, description, image }, { user, factories }) {
      // @makeAnIssue Create directives for arguments validation
      if (!Validator.string(name)) {
        throw new UserInputError('Invalid name length');
      }

      if (!Validator.string(description, 0)) {
        throw new UserInputError('Invalid description length');
      }
      const workspaceToUpdate = await factories.workspacesFactory.findById(workspaceId);

      try {
        /**
         * @type {WorkspaceDBScheme}
         */
        const options = {
          name,
          description,
        };

        if (image) {
          options.image = image;
        }

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

      if (userId) {
        const userModel = await factories.usersFactory.findById(userId);

        await workspace.removeMember(userModel);
      } else {
        await workspace.removeMemberByEmail(userEmail);
      }

      return true;
    },

    /**
     * Mutation in order to leave workspace
     * @param {ResolverObj} _obj - object that contains the result returned from the resolver on the parent field
     * @param {string} workspaceId - id of the workspace where the user should be removed
     * @param {UserInContext} user - current authorized user {@see ../index.js}
     * @param {ContextFactories} factories - factories for working with models
     * @return {Promise<boolean>} - true if operation is successful
     */
    async leaveWorkspace(_obj, { workspaceId }, { user, factories }) {
      const userModel = await factories.usersFactory.findById(user.id);
      const workspaceModel = await factories.workspacesFactory.findById(workspaceId);

      if (!workspaceModel) {
        throw new UserInputError('There is no workspace with provided id');
      }

      const memberInfo = await workspaceModel.getMemberInfo(user.id);

      if (memberInfo.isAdmin) {
        const membersInfo = (await workspaceModel.getMembers());
        const isThereOtherAdmins = !!membersInfo.find(
          member => member.isAdmin && member.userId.toString() !== user.id
        );

        if (!isThereOtherAdmins) {
          throw new ForbiddenError('You can\'t leave this workspace because you are the last admin');
        }
      }
      await workspaceModel.removeMember(userModel);

      return true;
    },

    /**
     * Change workspace plan mutation implementation
     *
     * @param {ResolverObj} _obj - object that contains the result returned from the resolver on the parent field
     * @param {string} workspaceId - id of workspace to change plan
     * @param {string} planId - plan to set
     * @param {ContextFactories} factories - factories to work with models
     */
    async changeWorkspacePlan(
      _obj,
      {
        input: { workspaceId, planId },
      },
      { factories }
    ) {
      const workspaceModel = await factories.workspacesFactory.findById(workspaceId);

      if (!workspaceModel) {
        throw new UserInputError('There is no workspace with provided id');
      }

      if (workspaceModel.plan === planId) {
        throw new UserInputError('Plan with given ID is already used for the workspace');
      }

      const planModel = await factories.plansFactory.findById(planId);

      if (!planModel) {
        throw new UserInputError('Plan with passed ID doesn\'t exists');
      }

      await workspaceModel.changePlan(planModel._id);

      return {
        recordId: workspaceModel._id,
        record: workspaceModel,
      };
    },
  },
  Workspace: {
    /**
     * Fetch projects in workspace
     * @param {ResolverObj} workspace - result from resolver above
     * @param {String[]} ids - project ids
     * @returns {Promise<Project[]>}
     */
    async projects(workspace, { ids }) {
      const projectToWorkspace = new ProjectToWorkspace(workspace._id);

      return projectToWorkspace.getProjects(ids);
    },

    /**
     * Returns workspace team
     * @param {WorkspaceDBScheme} workspaceData - result from resolver above
     * @param _args - empty list of args
     * @param {ContextFactories} factories - factories for working with models
     * @return {Promise<MemberDBScheme[]>}
     */
    async team(workspaceData, _args, { factories }) {
      const workspaceModel = await factories.workspacesFactory.findById(workspaceData._id.toString());

      return workspaceModel.getMembers();
    },

    /**
     * Returs workspace balance
     * @param {WorkspaceDBScheme} workspace - result from resolver above
     * @param _args - empty list of args
     * @param {string} accounting - accounting microservice
     * @returns {Promise<number>}
     */
    async balance(workspace, _args, { accounting }) {
      const accountId = workspace.accountId;
      const account = await accounting.getAccount(accountId);

      return account.balance;
    },

    /**
     * Returns workspace plan
     *
     * @param {WorkspaceDBScheme} workspace - result from resolver above
     * @param _args - empty list of arguments
     * @param {ContextFactories} factories - factories to work with models
     * @returns {Promise<PlanModel>}
     */
    async plan(workspace, _args, { factories }) {
      const plan = await factories.plansFactory.findById(workspace.plan);

      return new PlanModel(plan);
    },
  },

  /**
   * Resolver for Union Member type.
   * Represents two types of Members in workspace's team
   */
  Member: {
    /**
     * Returns type of the team member
     * @param {MemberDBScheme} memberData - result from resolver above
     */
    __resolveType(memberData) {
      return WorkspaceModel.isPendingMember(memberData) ? 'PendingMember' : 'ConfirmedMember';
    },
  },

  /**
   * Resolver for confirmed member data in workspace
   */
  ConfirmedMember: {
    /**
     * Fetch user of the workspace
     * @param {ConfirmedMemberDBScheme} memberData - result from resolver above
     * @param _args - empty list of args
     * @param {ContextFactories} factories - factories for working with models
     */
    user(memberData, _args, { factories }) {
      return factories.usersFactory.findById(memberData.userId.toString());
    },

    /**
     * True if user has admin permissions
     * @param {ConfirmedMemberDBScheme} memberData - result from resolver above
     */
    isAdmin(memberData) {
      return !WorkspaceModel.isPendingMember(memberData) && (memberData.isAdmin || false);
    },
  },
};
