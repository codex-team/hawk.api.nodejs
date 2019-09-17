const MongoWatchController = require('../utils/mongoWatchController');
const Membership = require('../models/membership');
const { ProjectToWorkspace } = require('../models/project');
const EventsFactory = require('../models/eventsFactory');
const asyncForEach = require('../utils/asyncForEach');
const mongo = require('../mongo');

const watchController = new MongoWatchController();

/**
 * See all types and fields here {@see ../typeDefs/event.graphql}
 */
module.exports = {
  Event: {
    id: parent => parent._id // rename MongoDB _id to id
  },
  Query: {
    /**
     * Returns Events list ordered by timestamp
     *
     * @param {ResolverObj} _obj
     * @param {String} projectId
     * @param {Number} limit
     * @param {Number} skip
     *
     * @return {Event[]}
     */
    async events(_obj, { projectId, limit, skip }) {
      const eventsFactory = new EventsFactory(projectId);

      return eventsFactory.find({}, limit, skip);
    },

    /**
     * Returns recent Events grouped by day
     *
     * @param {ResolverObj} _obj
     * @param {String} projectId - id of the project
     * @param {Number} limit - maximum number of results
     * @param {Number} skip - certain number of documents to skip
     * @return {RecentEvent[]}
     */
    async recent(_obj, { projectId, limit = 50, skip = 0 }) {
      const eventsFactory = new EventsFactory(projectId);

      return eventsFactory.findRecent(limit, skip);
    },

    /**
     * Returns event information in the project
     *
     * @param {ResolverObj} _obj
     * @param {String} projectId
     * @param {String} eventId
     *
     * @return {Event}
     */
    async event(_obj, { projectId, eventId }) {
      const eventsFactory = new EventsFactory(projectId);

      return eventsFactory.findById(eventId);
    },

    /**
     * Returns repetitions list of the event
     *
     * @param {ResolverObj} _obj
     * @param {String} eventId
     * @param {String} projectId - id of the project
     * @param {Number} limit - maximum number of results
     * @param {Number} skip - certain number of documents to skip
     * @return {Event[]}
     */
    async repetitions(_obj, { projectId, eventId, limit, skip }) {
      const eventsFactory = new EventsFactory(projectId);

      return eventsFactory.getRepetitions(eventId, limit, skip);
    }
  },
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
        const userId = context.user.id;
        // eslint-disable-next-line no-async-promise-executor
        const eventsCollections = new Promise(async resolve => {
          // @todo optimize query for getting all user's projects

          // Find all user's workspaces
          const allWorkspaces = await (new Membership(userId)).getWorkspaces();
          const allProjects = [];

          // Find all user's projects
          await asyncForEach(allWorkspaces, async workspace => {
            const allProjectsInWorkspace = await new ProjectToWorkspace(workspace.id).getProjects();

            allProjects.push(...allProjectsInWorkspace);
          });

          resolve(allProjects.map(project =>
            mongo.databases.events
              .collection('events:' + project.id)
          ));
        });

        return watchController.getAsyncIteratorForCollectionChangesEvents(eventsCollections);
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
