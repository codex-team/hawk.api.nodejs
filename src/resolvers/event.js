const MongoWatchController = require('../utils/mongoWatchController');
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
    /**
     * Returns Event with concrete repetition
     *
     * @param {string} eventId - id of Event of where repetition requested
     * @param {string} projectId - projectId of Event of where repetition requested
     * @param {string|null} [repetitionId] - if not specified, last repetition will returned
     * @return {Promise<EventRepetitionSchema>}
     */
    async repetition({ id: eventId, projectId }, { id: repetitionId }) {
      const factory = new EventsFactory(projectId);

      if (!repetitionId) {
        return factory.getEventLastRepetition(eventId);
      }

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
    },
  },
  Subscription: {
    eventOccurred: {
      /**
       * Subscribes user to events from his projects
       * @param {ResolverObj} _obj
       * @param {Object} _args - request variables (not used)
       * @param {UserInContext} user - current authorized user {@see ../index.js}
       * @param {ContextFactories} factories - factories for working with models
       * @return {AsyncIterator<EventSchema>}
       */
      subscribe: async (_obj, _args, { user, factories }) => {
        const userId = user.id;
        const userModel = await factories.usersFactory.findById(userId);
        // eslint-disable-next-line no-async-promise-executor
        const eventsCollections = new Promise(async resolve => {
          // @todo optimize query for getting all user's projects

          // Find all user's workspaces
          const allWorkspaces = await userModel.getWorkspaces();
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
      },
    },
  },
  Mutation: {
    /**
     * Mark event as visited for current user
     *
     * @param {ResolverObj} _obj
     * @param {string} project - project id
     * @param {string} id - event id
     * @param {UserInContext} user
     * @return {Promise<boolean>}
     */
    async visitEvent(_obj, { project, id }, { user }) {
      const factory = new EventsFactory(project);

      const { result } = await factory.visitEvent(id, user.id);

      return !!result.ok;
    },
  },
};
