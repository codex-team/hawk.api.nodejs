const MongoWatchController = require('../utils/mongoWatchController');

const watchController = new MongoWatchController();

/**
 * See all types and fields here {@see ../typeDefs/event.graphql}
 */
module.exports = {
  Subscription: {
    eventOccurred: {
      /**
       * Subscribes user to events from his projects
       * @param {ResolverObj} _obj
       * @param {Object} _args - request variables (not used)
       * @param {Context} context
       * @return {AsyncIterator<EventSchema>}
       */
      subscribe: (_obj, _args, context) => {
        return watchController.getAsyncIteratorForUserEvents(context.user.id);
      },

      /**
       * Sends data to user about new events
       * @param {Object} payload - subscription event payload (from mongoDB watch)
       * @return {EventSchema}
       */
      resolve: (payload) => {
        return payload.fullDocument;
      }
    }
  }
};
