const { ValidationError } = require('apollo-server-express');
const { ObjectID } = require('mongodb');
const Membership = require('../models/membership');
const { Project, ProjectToWorkspace } = require('../models/project');
const Team = require('../models/team');
const NotifyFactory = require('../models/notifyFactory');
const Notify = require('../models/notify');
const eventResolvers = require('./event');

/**
 * See all types and fields here {@see ../typeDefs/project.graphql}
 */
module.exports = {
  Query: {
    /**
     * Returns project's Model
     * @param {ResolverObj} _obj
     * @param {String} id - project id
     * @return {Promise<ProjectSchema>}
     */
    async project(_obj, { id }) {
      return Project.findById(id);
    }
  },
  Mutation: {
    /**
     * Creates project
     *
     * @param {ResolverObj} _obj
     * @param {string} workspaceId - workspace ID
     * @param {string} name - project name
     * @param {Context.user} user - current authorized user {@see ../index.js}
     * @return {Project[]}
     */
    async createProject(_obj, { workspaceId, name }, { user }) {
      // Check workspace ID
      const workspace = await new Membership(user.id).getWorkspaces([
        workspaceId
      ]);

      if (!workspace) {
        throw new ValidationError('No such workspace');
      }

      /**
       * Set default project notify settings
       */
      const projectNotify = Notify.defaultNotify;

      projectNotify.settings.email.enabled = false;

      const project = await Project.create({
        name,
        uidAdded: new ObjectID(user.id),
        notify: projectNotify
      });

      // Create Project to Workspace relationship
      new ProjectToWorkspace(workspaceId).add({ projectId: project.id });

      /*
       * Set default notification settings for all users in workspace:
       * Get all workspace users -> set default notify
       */
      const team = new Team(workspaceId);

      const users = await team.getAllUsers();

      /*
       * Probably deadly race condition bug here if following code not applied
       * if (!users.findIndex((el, idx) => el.id === user.id)){
       *   users.push(await User.findOne({_id: user.id}));
       * }
       */

      const notifyFactory = new NotifyFactory(project.id);

      for (const projectUser of users) {
        try {
          const notify = Notify.defaultNotify;

          notify.userId = new ObjectID(projectUser.id);
          notify.settings.email.value = projectUser.email;

          const result = await notifyFactory.update(notify);

          if (!result) {
            console.warn(`Couldn't set Notify for user ${projectUser.id}, projectId: ${project.id}`);
          }
        } catch (err) {
          console.error(err);
        }
      }

      return project;
    }
  },
  Project: {
    /**
     * Find project events
     *
     * @param {String} id  - id of project (root resolver)
     * @param {number} limit - query limit
     * @param {number} skip - query skip
     * @param {Context.user} user - current authorized user {@see ../index.js}
     * @returns {Promise<EventSchema[]>}
     */
    async events({ id }, { limit, skip }) {
      return eventResolvers.Query.events({}, { projectId: id, limit, skip });
    },

    /**
     * Returns recent Events grouped by day
     *
     * @param {ResolverObj} _obj
     * @param {Number} limit - limit for events count
     *
     * @return {RecentEvent[]}
     */
    async recentEvents({ id }, { limit }) {
      // @makeAnIssue remove aliases to event resolvers in project resolvers
      const result = await eventResolvers.Query.recent({}, { projectId: id, limit });

      return result.shift();
    }
  }
};
