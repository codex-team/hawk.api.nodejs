const Membership = require('../models/membership');
const { ProjectToWorkspace } = require('../models/project');
const mongo = require('../mongo');
const asyncForEach = require('./asyncForEach');

/**
 * An array of aggregation pipeline stages through which to pass change stream documents.
 * This allows for filtering (using $match) and manipulating the change stream documents.
 */
const pipeline = [
  {
    $match: { 'operationType': 'insert' }
  },
  {
    $addFields: {
      'fullDocument.id': '$fullDocument._id'
    }
  }
];

/**
 * Controls events streams from project for per user
 */
class MongoWatchController {
  /**
   * Setup watch streams on events collections and return common event emitter for all this streams
   * @param {String} userId - id of the user whose events we will watch
   * @return {Promise<Object>}
   */
  async getEventEmitterForUserProjects(userId) {
    // @todo optimize query for getting all user's projects

    // Find all user's workspaces
    const allWorkspaces = await (new Membership(userId)).getWorkspaces();
    const allProjects = [];

    // Find all user's projects
    await asyncForEach(allWorkspaces, async workspace => {
      const allProjectsInWorkspace = await new ProjectToWorkspace(workspace.id).getProjects();

      allProjects.push(...allProjectsInWorkspace);
    });

    const changeStreams = allProjects.map(project =>
      mongo.databases.events
        .collection('events:' + project.id)
        .watch(pipeline)
    );

    return {

      /**
       * Adds the handler function for the event named eventName
       * @param {String} eventName - event name to subscribe
       * @param {function} handler - event handler
       */
      on(eventName, handler) {
        changeStreams.forEach(stream => stream.on(eventName, handler));
      },

      /**
       * Closes all changeStreams inside of event emitter
       */
      close() {
        changeStreams.forEach(stream => stream.close());
      }
    };
  }

  /**
   * Setups watch streams and returns async iterator which will be resolved when event will come
   * @param {String} userId - id of the user whose events we will watch
   * @return {AsyncIterator<EventSchema>}
   */
  getAsyncIteratorForUserEvents(userId) {
    // contains not called resolvers
    const pullQueue = [];

    // contains unprocessed events
    const pushQueue = [];

    // is iterator done his work
    let done = false;

    // event emitter for subscribing
    let emitter;

    // pushes value from emitter event to the pushQueue or resolves it if pullQueue is not empty
    const pushValue = async (args) => {
      if (pullQueue.length !== 0) {
        const resolver = pullQueue.shift();

        resolver(...args);
      } else {
        pushQueue.push(args);
      }
    };

    const handler = (...args) => {
      pushValue(args);
    };

    // if there are some event in pushQueue -- resolve it. Else push resolver to the pullQueue
    const pullValue = async () => {
      if (!emitter) {
        emitter = await this.getEventEmitterForUserProjects(userId);
        emitter.on('change', handler);
      }
      return new Promise(resolve => {
        if (pushQueue.length !== 0) {
          const args = pushQueue.shift();

          resolve(...args);
        } else {
          pullQueue.push(resolve);
        }
      });
    };

    return {
      // specifies the default AsyncIterator for an object
      [Symbol.asyncIterator]() {
        return this;
      },

      // next value of the iterator
      next: async () => ({
        done,
        value: done ? undefined : await pullValue()
      }),

      // called when iterator ends work
      return: () => {
        emitter.close();
        done = true;
        return { done };
      },

      // called when any error occurred
      throw: async (error) => {
        emitter.close();
        done = true;
        return {
          done,
          value: Promise.reject(error)
        };
      }
    };
  }
}

module.exports = MongoWatchController;
