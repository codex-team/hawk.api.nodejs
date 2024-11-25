import WorkspaceModel from '../models/workspace';
import { AccountType, Currency } from 'codex-accounting-sdk/types';
import PlanModel from '../models/plan';
import * as telegram from '../utils/telegram';
import HawkCatcher from '@hawk.so/nodejs';
import escapeHTML from 'escape-html';
import { emailNotification, TaskPriorities } from '../utils/emailNotifications';
import { SenderWorkerTaskType } from '../types/userNotifications';
import ProjectToWorkspace from '../models/projectToWorkspace';
import Validator from '../utils/validator';
import { dateFromObjectId } from '../utils/dates';
import cloudPaymentsApi from '../utils/cloudPaymentsApi';


const { ApolloError, UserInputError, ForbiddenError } = require('apollo-server-express');
const crypto = require('crypto');

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
     * @return {WorkspaceModel} created workspace
     */
    async createWorkspace(_obj, { name, description, image }, { user, factories, accounting }) {
      try {
        // Create workspace account and set account id to workspace
        // const accountResponse = await accounting.createAccount({
        //   name: 'WORKSPACE:' + name,
        //   type: AccountType.LIABILITY,
        //   currency: Currency.RUB,
        // });

        // const accountId = accountResponse.recordId;
        const accountId = null;

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

        telegram.sendMessage(`🌌 Workspace "${name}" was created`);

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

      /**
       * If user is already uses Hawk
       */
      if (invitedUser) {
        /**
         * Check for a membership
         */
        const [ isUserInThatWorkspace ] = await invitedUser.getWorkspacesIds([ workspaceId ]);

        if (isUserInThatWorkspace) {
          throw new ApolloError('User already invited to this workspace');
        }

        /**
         * User is not in the workspace team then we need
         * to add his email to list of members
         */
        await invitedUser.addWorkspace(workspaceId, true);
      }

      await workspace.addMemberByEmail(userEmail);

      const linkHash = crypto
        .createHash('sha256')
        .update(`${workspaceId}:${userEmail}:${process.env.INVITE_LINK_HASH_SALT}`)
        .digest('hex');

      const inviteLink = `${process.env.GARAGE_URL}/join/${workspaceId}/${linkHash}`;

      await emailNotification({
        type: SenderWorkerTaskType.WorkspaceInvite,
        payload: {
          workspaceName: workspace.name,
          inviteLink,
          endpoint: userEmail,
        },
      }, {
        priority: TaskPriorities.IMPORTANT,
      });

      return true;
    },

    /**
     * Join to workspace by invite link with invite hash
     *
     * @param {ResolverObj} _obj - object that contains the result returned from the resolver on the parent field
     * @param {String} inviteHash - hash passed to the invite link
     * @param {UserInContext} user - current authorized user {@see ../index.js}
     * @param {ContextFactories} factories - factories for working with models
     *
     * @return {Promise<object>} - true if operation is successful
     */
    async joinByInviteLink(_obj, { inviteHash }, { user, factories }) {
      const currentUser = await factories.usersFactory.findById(user.id);
      const workspace = await factories.workspacesFactory.findByInviteHash(inviteHash);

      if (await workspace.getMemberInfo(user.id)) {
        throw new ApolloError('You are already member of this workspace');
      }

      await workspace.addMember(currentUser._id.toString());
      await currentUser.addWorkspace(workspace._id.toString());

      telegram.sendMessage(`🤝 User "${currentUser.email || currentUser.name}" joined to "${workspace.name}"`);

      return {
        recordId: workspace._id.toString(),
        record: workspace,
      };
    },

    /**
     * Confirm user invitation by special link for user (for example, from email invitation)
     *
     * @param {ResolverObj} _obj - object that contains the result returned from the resolver on the parent field
     * @param {String} inviteHash - hash passed to the invite link
     * @param {String} workspaceId - id of the workspace to which the user is invited
     * @param {UserInContext} user - current authorized user {@see ../index.js}
     * @param {ContextFactories} factories - factories for working with models
     *
     * @return {Promise<object>} - true if operation is successful
     */
    async confirmInvitation(_obj, { inviteHash, workspaceId }, { user, factories }) {
      const currentUser = await factories.usersFactory.findById(user.id);
      const workspace = await factories.workspacesFactory.findById(workspaceId);

      const hash = crypto
        .createHash('sha256')
        .update(`${workspaceId}:${currentUser.email}:${process.env.INVITE_LINK_HASH_SALT}`)
        .digest('hex');

      if (hash !== inviteHash) {
        throw new ApolloError('The link is broken');
      }

      await workspace.confirmMembership(currentUser);
      await currentUser.addWorkspace(workspaceId);

      return {
        recordId: workspace._id.toString(),
        record: workspace,
      };
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
     * Change workspace plan for default plan mutation implementation
     *
     * @param {ResolverObj} _obj - object that contains the result returned from the resolver on the parent field
     * @param {string} workspaceId - id of workspace to change plan
     * @param {ContextFactories} factories - factories to work with models
     */
    async changeWorkspacePlanToDefault(
      _obj,
      {
        input: { workspaceId },
      },
      { factories, user }
    ) {
      const workspaceModel = await factories.workspacesFactory.findById(workspaceId);

      if (!workspaceModel) {
        throw new UserInputError('There is no workspace with provided id');
      }

      const defaultPlan = await factories.plansFactory.getDefaultPlan();

      if (workspaceModel.tariffPlanId === defaultPlan.id) {
        throw new UserInputError('You already use default plan');
      }

      const oldPlanModel = await factories.plansFactory.findById(workspaceModel.tariffPlanId);
      const userModel = await factories.usersFactory.findById(user.id);

      try {
        const date = new Date();

        // Push old plan to plan history
        await workspaceModel.updatePlanHistory(workspaceModel.tariffPlanId, date, userModel._id);

        // Update workspace last charge date
        await workspaceModel.updateLastChargeDate(date);

        // Change workspace plan
        await workspaceModel.changePlan(defaultPlan._id);
      } catch (err) {
        console.error('\nლ(´ڡ`ლ) Error [resolvers:workspace:changeWorkspacePlan]: \n\n', err, '\n\n');
        HawkCatcher.send(err);

        throw new ApolloError('An error occurred while changing the plan');
      }

      // Send a message of a succesfully plan changed to the telegram bot
      const message = `🤑 <b>${escapeHTML(userModel.name || userModel.email)}</b> changed plan of «<b>${escapeHTML(workspaceModel.name)}</b>» workspace

⭕️ <i>${oldPlanModel.name} $${oldPlanModel.monthlyCharge}</i> → ✅ <b>${defaultPlan.name} $${defaultPlan.monthlyCharge}</b> `;

      telegram.sendMessage(message);

      const updatedWorkspaceModel = await factories.workspacesFactory.findById(workspaceId);

      return {
        recordId: workspaceId,
        record: updatedWorkspaceModel,
      };
    },

    /**
     * Return empty object to call resolver for specific mutation
     */
    workspace: () => ({}),
  },
  Workspace: {
    /**
     * Returns workspace creation date
     *
     * @param {WorkspaceDBScheme} workspace - result of parent resolver
     *
     * @returns {Date}
     */
    creationDate(workspace) {
      return dateFromObjectId(workspace._id);
    },

    /**
     * Returns workspace invite hash
     * If workspace has not hash this resolver generates it
     *
     * @param {WorkspaceDBScheme} workspaceData - result from resolver above
     * @param _args - empty list of args
     * @param {ContextFactories} factories - factories for working with models
     *
     * @returns {Promise<string>}
     */
    async inviteHash(workspaceData, _args, { factories }) {
      if (workspaceData.inviteHash && workspaceData.inviteHash !== '') {
        return workspaceData.inviteHash;
      }
      const inviteHash = WorkspaceModel.generateInviteHash();
      const workspace = await factories.workspacesFactory.findById(workspaceData._id);

      if (!workspace) {
        throw Error('Can\'t find workspace with this id: ' + workspaceData._id);
      }

      await workspace.updateInviteHash(inviteHash);

      return workspace.inviteHash;
    },

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
    async team(workspaceData, _args, { factories, user }) {
      /**
       * Crutch for Demo Workspace
       */
      if (workspaceData._id.toString() === '6213b6a01e6281087467cc7a') {
        return [
          {
            _id: user.id,
            userId: user.id,
            isAdmin: true,
          },
        ];
      }

      const workspaceModel = await factories.workspacesFactory.findById(workspaceData._id.toString());

      return workspaceModel.getMembers();
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
      const plan = await factories.plansFactory.findById(workspace.tariffPlanId);

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

  WorkspaceMutations: {
    /**
     * Cancels subscription for workspace
     * @param _obj - result of the parent resolver
     * @param {string} workspaceId - workspace id to cancel subscription for
     * @param {ContextFactories} factories - factories to work with models
     * @return {Promise<{recordId: *, record: {subscriptionId: null}}>}
     */
    async cancelSubscription(
      _obj,
      {
        input: { workspaceId },
      },
      { factories }
    ) {
      const workspaceModel = await factories.workspacesFactory.findById(workspaceId);

      if (!workspaceModel) {
        throw new UserInputError('There is no workspace with provided id');
      }

      if (!workspaceModel.subscriptionId) {
        throw new UserInputError('There is no subscription for provided workspace');
      }

      await cloudPaymentsApi.cancelSubscription(workspaceModel.subscriptionId);

      await workspaceModel.setSubscriptionId(null)

      return {
        recordId: workspaceModel._id,
        record: {
          ...workspaceModel,
          subscriptionId: null,
        },
      };
    },
  },
};
