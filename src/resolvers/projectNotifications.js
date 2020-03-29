const Notify = require('../models/notify');

/**
 * See all types and fields here {@see ../typeDefs/notify.graphql}
 */
module.exports = {
  Mutation: {
    /**
     * Creates new notification rule for project common settings
     * @param _obj - parent object
     * @param {object} input - input data for creating
     */
    createProjectNotificationsRule(_obj, input) {
      return Notify.getDefaultNotify().shift();
    },
  },
};
