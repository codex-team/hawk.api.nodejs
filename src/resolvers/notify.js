const { ObjectID } = require('mongodb');
const Notify = require('../models/notify');
const NotifyFactory = require('../models/notifyFactory');
const { Project } = require('../models/project');
const Team = require('../models/team');

/**
 * See all types and fields here {@see ../typeDefs/notify.graphql}
 */
module.exports = {
  Query: {
    /**
     * Get project personal notifications settings
     * @param {ResolverObj} _obj
     * @param {String} id - array of project ids to get
     * @param user - current authorized user {@see ../index.js}
     * @returns {Promise<NotifySchema|null>}
     */
    async personalNotificationSettings(_obj, { projectId }, { user }) {
      const project = await Project.findById(projectId);

      /**
       * Return null if project not exists
       */
      if (!project) return null;

      const team = new Team(project.workspaceId);

      const teamInstance = await team.findByUserId(user.id);

      /**
       * Return null if user is not in workspace or is not admin
       */
      if (!teamInstance || teamInstance.isPending) return null;

      const factory = new NotifyFactory(projectId);

      return factory.findByUserId(user.id);
    },

    /**
     * Get project personal notifications settings. Only for admins.
     * @param {ResolverObj} _obj
     * @param {String} projectId - array of project ids to get
     * @param user - current authorized user {@see ../index.js}
     * @returns {Promise<NotifySchema|null>}
     */
    async commonNotificationSettings(_obj, { projectId }, { user }) {
      /**
       * First check if user is in workspace and is he admin.
       *
       * get project -> project.workspaceId -> get team:<workspaceId>
       */

      const project = await Project.findById(projectId);

      /**
       * Return null if project not exists
       */
      if (!project) return null;

      const team = new Team(project.workspaceId);

      const teamInstance = await team.findByUserId(user.id);

      /**
       * Return null if user is not in workspace or is not admin
       */
      if (!teamInstance || teamInstance.isPending || !teamInstance.isAdmin) return null;

      return project.notify;
    }
  },
  Mutation: {
    /**
     * Update project personal notifications settings
     * @param {ResolverObj} _obj
     * @param {String} projectId - Project ID
     * @param {NotifySchema} settings - Notify settings
     * @param {Context.user} user - current authorized user {@see ../index.js}
     * @returns {Promise<NotifySchema|null>}
     */
    async updatePersonalNotificationSettings(_obj, { projectId, notify }, { user }) {
      const project = await Project.findById(projectId);

      /**
       * Return null if project not exists
       */
      if (!project) return null;

      const team = new Team(project.workspaceId);

      const teamInstance = await team.findByUserId(user.id);

      /**
       * Return null if user is not in workspace or is not admin
       */
      if (!teamInstance || teamInstance.isPending) return null;

      const factory = new NotifyFactory(projectId);
      const updatedNotify = new Notify({ userId: new ObjectID(user.id), ...notify });

      const success = await factory.update(updatedNotify);

      if (!success) throw new Error('Failed to update user notify');

      return factory.findByUserId(user.id);
    },

    /**
     * Update project common notifications settings. Only for admins.
     * @param {ResolverObj} _obj
     * @param {String} projectId - Project ID
     * @param {NotifySettings} settings - Notify settings
     * @param {Context.user} user - current authorized user {@see ../index.js}
     * @returns {Promise<NotifySchema|null>}
     */
    async updateCommonNotificationSettings(_obj, { projectId, notify }, { user }) {
      /**
       * First check if user is in workspace and is he admin.
       *
       * get project -> project.workspaceId -> get team:<workspaceId>
       */

      const project = await Project.findById(projectId);

      /**
       * Return null if project not exists
       */
      if (!project) return null;

      const team = new Team(project.workspaceId);

      const teamInstance = await team.findByUserId(user.id);

      /**
       * Return null if user is not in workspace or is not admin
       */
      if (!teamInstance || !teamInstance.isAdmin) return null;

      const success = await Project.updateNotify(projectId, notify);

      if (!success) throw new Error('Failed to update project notify');

      return (await Project.findById(projectId)).notify;
    }
  }
};
