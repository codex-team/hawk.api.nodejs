const { PubSub } = require('apollo-server-express');
const pubsub = new PubSub();

module.exports = {
  Subscription: {
    eventOccurred: {
      subscribe: (payload, args, context, info) => {
        return pubsub.asyncIterator([ 'eventOccurred' ]);
      },
      resolve: (payload, args, context, info) => 'ddawdesdwawoooork'
    }
  },
  Query: {
    fire: () => {
      pubsub.publish('eventOccurred', { eventOccurred: { lol: 'lol' } });
      return true;
    }
  }
};

class MongoWatchController {
  constructor() {
    this.watchingProjects = {};
  }

  setupWatchingForUserProject(userId) {
    // find all users projects
  }
}
