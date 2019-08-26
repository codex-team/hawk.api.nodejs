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
     * @param {String[]} ids - array of project ids to get
     * @param {Number} limit - limit
     * @param {Number} skip - skip
     * @param user - current authorized user {@see ../index.js}
     * @returns {Promise<Notify[]>}
     */
    async notifications(_obj, { ids, limit, skip }, { user }) {
      const factory = new NotifyFactory(user.id);

      ids = ids.map(id => new ObjectID(id));

      if (ids.length) {
        return factory.find({ projectId: { $in: ids } }, limit, skip);
      }

      return factory.find({}, limit, skip);
    }
  },
  Mutation: {
    /**
     * Update notifications settings
     * @param {ResolverObj} _obj
     * @param {String} projectId - Project ID
     * @param {NotifySettings} settings - Notify settings
     * @param {Context.user} user - current authorized user {@see ../index.js}
     * @returns {Promise<Notify|null>}
     */
    async updateSettings(_obj, { projectId, settings }, { user }) {
      const factory = new NotifyFactory(user.id);
      const notify = new Notify({ projectId: new ObjectID(projectId), settings });

      return factory.update(notify);
    }
  }
};
