const Notify = require('../models/notify');

/**
 * See all types and fields here {@see ../typeDefs/notify.graphql}
 */
module.exports = {
  Mutation: {
    createCommonNotificationsRule(_obj, input, { user, factories }) {
      return Notify.getDefaultNotify().shift();
    },
  //   /**
  //    * Update project personal notifications settings
  //    * @param {ResolverObj} _obj
  //    * @param {String} projectId - Project ID
  //    * @param {NotificationSettingsSchema} settings - Notify settings
  //    * @param {Context.user} user - current authorized user {@see ../index.js}
  //    * @param {ContextFactories} factories - factories for working with models
  //    * @returns {Promise<NotificationSettingsSchema|null>}
  //    */
  //   async updatePersonalNotificationSettings(_obj, { projectId, notifySettings }, { user, factories }) {
  //     const project = await Project.findById(projectId);
  //
  //     /**
  //      * Return null if project not exists
  //      */
  //     if (!project) {
  //       return null;
  //     }
  //
  //     const workspace = await factories.workspacesFactory.findById(project.workspaceId);
  //
  //     if (!workspace) {
  //       throw new UserInputError('No such workspace');
  //     }
  //
  //     const memberInfo = await workspace.getMemberInfo(user.id);
  //
  //     if (!memberInfo) {
  //       throw new ForbiddenError('You are not member of this workspace');
  //     }
  //
  //     if (!memberInfo.isAdmin) {
  //       throw new ForbiddenError('Only admins can create projects in workspace');
  //     }
  //
  //     const factory = new UserInProject(user.id, projectId);
  //     const success = await factory.updatePersonalNotificationsSettings(notifySettings);
  //
  //     if (!success) {
  //       throw new Error('Failed to update user notify');
  //     }
  //
  //     return factory.getPersonalNotificationsSettings(user.id);
  //   },
  //
  //   /**
  //    * Update project common notifications settings. Only for admins.
  //    * @param {ResolverObj} _obj
  //    * @param {String} projectId - Project ID
  //    * @param {NotificationSettingsSchema} notifySettings - notification settings
  //    * @param {Context.user} user - current authorized user {@see ../index.js}
  //    * @param {ContextFactories} factories - factories for working with models
  //    * @returns {Promise<NotificationSettingsSchema>}
  //    */
  //   async updateCommonNotificationSettings(_obj, { projectId, notifySettings }, { user, factories }) {
  //     /**
  //      * First check if user is in workspace and is he admin.
  //      *
  //      * get project -> project.workspaceId -> get team:<workspaceId>
  //      */
  //
  //     const project = await Project.findById(projectId);
  //
  //     /**
  //      * Return null if project not exists
  //      */
  //     if (!project) {
  //       throw new ApolloError('Project not exists');
  //     }
  //
  //     const workspace = await factories.workspacesFactory.findById(project.workspaceId);
  //
  //     if (!workspace) {
  //       throw new UserInputError('No such workspace');
  //     }
  //
  //     const memberInfo = await workspace.getMemberInfo(user.id);
  //
  //     if (!memberInfo) {
  //       throw new ForbiddenError('You are not member of this workspace');
  //     }
  //
  //     if (!memberInfo.isAdmin) {
  //       throw new ForbiddenError('You are not allowed to edit this settings');
  //     }
  //
  //     const success = await Project.updateNotify(projectId, notifySettings);
  //
  //     if (!success) {
  //       throw new Error('Failed to update project notify');
  //     }
  //
  //     return (await Project.findById(projectId)).commonNotificationsSettings;
  //   },
  },
};
