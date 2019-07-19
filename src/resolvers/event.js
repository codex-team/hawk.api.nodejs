const MongoWatchController = require('../utils/mongoWatchController');

const controller = new MongoWatchController();

module.exports = {
  Subscription: {
    eventOccurred: {
      subscribe: (payload, args, context) => {
        return controller.getAsyncIteratorForUserEvents(context.user.id);
      },
      resolve: (payload) => {
        return payload.fullDocument;
      }
    }
  }
};
