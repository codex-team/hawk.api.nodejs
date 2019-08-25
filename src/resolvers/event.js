const MongoWatchController = require('../utils/mongoWatchController');
const Membership = require('../models/membership');
const { ProjectToWorkspace } = require('../models/project');
const EventService = require('../services/eventService');
const asyncForEach = require('../utils/asyncForEach');
const mongo = require('../mongo');

const watchController = new MongoWatchController();

/**
 * See all types and fields here {@see ../typeDefs/event.graphql}
 */
module.exports = {
  Query: {
    async events(_obj, { projectId }) {
      const service = new EventService(projectId);
      const events = await service.find({}, 10);

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
