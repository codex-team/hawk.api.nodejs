const MongoWatchController = require('../utils/mongoWatchController');
const Membership = require('../models/membership');
const { ProjectToWorkspace } = require('../models/project');
const asyncForEach = require('../utils/asyncForEach');
const mongo = require('../mongo');
const EventsFactory = require('../models/eventsFactory');

const watchController = new MongoWatchController();

/**
 * See all types and fields here {@see ../typeDefs/event.graphql}
 */
module.exports = {
  Event: {
    id: parent => parent._id, // rename MongoDB _id to id

    /**
     * Returns Event with concrete repetition
     *
     * @param {String} projectId
     * @param {String} repetitionId
     * @return {Promise<EventRepetitionSchema>}
     */
    async repetition({ projectId }, { id: repetitionId }) {
      const factory = new EventsFactory(projectId);

      return factory.getEventRepetition(repetitionId);
    },

    /**
     * Returns repetitions list of the event
     *
     * @param {ResolverObj} _obj
     * @param {String} eventId
     * @param {String} projectId
     * @param {Number} limit
     * @param {Number} skip
     *
     * @return {EventRepetitionSchema[]}
     */
    async repetitions({ _id: eventId, projectId }, { limit, skip }) {
      const factory = new EventsFactory(projectId);

      return factory.getEventRepetitions(eventId, limit, skip);
    }
  },
  Repetition: {
    id: parent => parent._id // rename MongoDB _id to id
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
