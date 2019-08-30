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
    id: parent => parent._id
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
      const service = new EventsFactory(projectId);
      const events = await service.find({}, limit, skip);

      return events;
    },

    /**
     * Returns recent Events grouped by day
     *
     * @param {ResolverObj} _obj
     * @param {String} projectId
     * @param {Number} limit
     *
     * @return {RecentEvent[]}
     */
    async recent(_obj, { projectId, limit = 50 }) {
      const service = new EventsFactory(projectId);

      return service.findRecent(limit);
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
      const service = new EventsFactory(projectId);
      const event = await service.findById(eventId);

      return event;
    },

    /**
     * Returns repetitions list of the event
     *
     * @param {ResolverObj} _obj
     * @param {String} projectId
     * @param {String} eventId
     * @param {Number} limit
     * @param {Number} skip
     * @return {Event[]}
     */
    async repetitions(_obj, { projectId, eventId, limit, skip }) {
      const service = new EventsFactory(projectId);
      const events = await service.getRepetitions(eventId, limit, skip);

      return events;
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
