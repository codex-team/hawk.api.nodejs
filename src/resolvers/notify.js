const { ApolloError } = require('apollo-server-express');
const { Project } = require('../models/project');
const Team = require('../models/team');
const UserInProject = require('../models/userInProject');

/**
 * See all types and fields here {@see ../typeDefs/notify.graphql}
 */
module.exports = {
  Mutation: {
    /**
     * Update project personal notifications settings
     * @param {ResolverObj} _obj
     * @param {String} projectId - Project ID
     * @param {NotificationSettingsSchema} settings - Notify settings
     * @param {Context.user} user - current authorized user {@see ../index.js}
     * @returns {Promise<NotificationSettingsSchema|null>}
     */
    async updatePersonalNotificationSettings(_obj, { projectId, notifySettings }, { user }) {
      const project = await Project.findById(projectId);

      /**
       * Return null if project not exists
       */
      if (!project) {
        return null;
      }

      const team = new Team(project.workspaceId);
      const teamInstance = await team.findByUserId(user.id);

      /**
       * Return null if user is not in workspace or is not admin
       */
      if (!teamInstance || teamInstance.isPending) {
        throw new ApolloError('User does not have access to this project');
      }

      const factory = new UserInProject(user.id, projectId);
      const success = await factory.updatePersonalNotificationsSettings(notifySettings);

      if (!success) {
        throw new Error('Failed to update user notify');
      }

      return factory.getPersonalNotificationsSettings(user.id);
    },

    /**
     * Update project common notifications settings. Only for admins.
     * @param {ResolverObj} _obj
     * @param {String} projectId - Project ID
     * @param {NotificationSettingsSchema} notifySettings - notification settings
     * @param {Context.user} user - current authorized user {@see ../index.js}
     * @returns {Promise<NotificationSettingsSchema>}
     */
    async updateCommonNotificationSettings(_obj, { projectId, notifySettings }, { user }) {
      /**
       * First check if user is in workspace and is he admin.
       *
       * get project -> project.workspaceId -> get team:<workspaceId>
       */

      const project = await Project.findById(projectId);

      /**
       * Return null if project not exists
       */
      if (!project) {
        throw new ApolloError('Project not exists');
      }

      const team = new Team(project.workspaceId);
      const teamInstance = await team.findByUserId(user.id);

      /**
       * Return null if user is not in workspace or is not admin
       */
      if (!teamInstance || !teamInstance.isAdmin) {
        throw new ApolloError('Only an administrator can change general settings');
      }

      const success = await Project.updateNotify(projectId, notifySettings);

      if (!success) {
        throw new Error('Failed to update project notify');
      }

      return (await Project.findById(projectId)).commonNotificationsSettings;
    },
  },
};
