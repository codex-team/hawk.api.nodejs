const MongoWatchController = require('../utils/mongoWatchController');
const Membership = require('../models/membership');
const { ProjectToWorkspace } = require('../models/project');
const mongo = require('../mongo');
const asyncForEach = require('../utils/asyncForEach');

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