const { ObjectID } = require('mongodb');
const Notify = require('../models/notify');
const NotifyFactory = require('../models/notifyFactory');

/**
 * See all types and fields here {@see ../typeDefs/notify.graphql}
 */
module.exports = {
  Query: {
    /**
     * Get notifications settings
     * @param {ResolverObj} _obj
     * @param {String} id - array of project ids to get
     * @param user - current authorized user {@see ../index.js}
     * @returns {Promise<Notify|null>}
     */
    async notificationSettings(_obj, { projectId }, { user }) {
      // todo: check if project exists & user belongs to the project

      const factory = new NotifyFactory(projectId);

      return factory.findByUserId(user.id);
    }
  },
  Mutation: {
    /**
     * Update notifications settings
     * @param {ResolverObj} _obj
     * @param {String} projectId - Project ID
     * @param {NotifySettings} settings - Notify settings
     * @param {Context.user} user - current authorized user {@see ../index.js}
     * @returns {Promise<Boolean>}
     */
    async updateNotificationSettings(_obj, { projectId, notify }, { user }) {
      // todo: check if project exists & user belongs to the project

      const factory = new NotifyFactory(projectId);
      const updatedNotify = new Notify({ userId: new ObjectID(user.id), ...notify });

      return factory.update(updatedNotify);
    }
  }
};
