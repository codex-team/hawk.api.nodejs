const { ValidationError, ApolloError } = require('apollo-server-express');
const Membership = require('../models/membership');
const { Project, ProjectToWorkspace } = require('../models/project');
const UserInProject = require('../models/userInProject');
const EventsFactory = require('../models/eventsFactory');
const Team = require('../models/team');
const Notify = require('../models/notify');
const User = require('../models/user').default;

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
    },
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
        workspaceId,
      ]);

      if (!workspace) {
        throw new ValidationError('No such workspace');
      }
      const team = new Team(workspaceId);
      const teamInstance = await team.findByUserId(user.id);

      if (!teamInstance.isAdmin) {
        throw new ApolloError('Only admins can create projects');
      }
      const project = await Project.create({
        name,
        workspaceId,
        uidAdded: user.id,
      });

      // Create Project to Workspace relationship
      new ProjectToWorkspace(workspaceId).add({ projectId: project.id });

      return project;
    },

    /**
     * Updates user visit time on project and returns it
     *
     * @param {ResolverObj} _obj
     * @param {String} projectId - project ID
     * @param {Context.user} user - current authorized user {@see ../index.js}
     * @return {Promise<Number>}
     */
    async updateLastProjectVisit(_obj, { projectId }, { user }) {
      const userInProject = new UserInProject(user.id, projectId);

      return userInProject.updateLastVisit();
    },
  },
  Project: {
    /**
     * Find project's event
     *
     * @param {String} id  - id of project (root resolver)
     * @param {String} eventId - event's identifier
     * @returns {Event}
     */
    async event({ id }, { id: eventId }) {
      const factory = new EventsFactory(id);
      const event = await factory.findById(eventId);

      event.projectId = id;

      return event;
    },

    /**
     * Find project events
     *
     * @param {String} id  - id of project (root resolver)
     * @param {number} limit - query limit
     * @param {number} skip - query skip
     * @param {Context.user} user - current authorized user {@see ../index.js}
     * @returns {Event[]}
     */
    async events({ id }, { limit, skip }) {
      const factory = new EventsFactory(id);

      return factory.find({}, limit, skip);
    },

    /**
     * Returns events count that wasn't seen on project
     *
     * @param {String} projectId - project identifier
     * @param {Object} data - additional data. In this case it is empty
     * @param {User} user - authorized user
     *
     * @return {Promise<number>}
     */
    async unreadCount({ id: projectId }, data, { user }) {
      const eventsFactory = new EventsFactory(projectId);
      const userInProject = new UserInProject(user.id, projectId);
      const lastVisit = await userInProject.getLastVisit();

      return eventsFactory.getUnreadCount(lastVisit);
    },

    /**
     * Returns recent Events grouped by day
     *
     * @param {ResolverObj} _obj
     * @param {Number} limit - limit for events count
     * @param {Number} skip - certain number of documents to skip
     *
     * @return {Promise<RecentEventSchema[]>}
     */
    async recentEvents({ id: projectId }, { limit, skip }) {
      const factory = new EventsFactory(projectId);

      return factory.findRecent(limit, skip);
    },

    /**
     * Get project personal notifications settings
     * @param {ProjectSchema} project
     * @param {object} _args - query args (empty for this query)
     * @param user - current authorized user {@see ../index.js}
     * @returns {Promise<NotificationSettingsSchema|null>}
     */
    async personalNotificationsSettings(project, _args, { user }) {
      const team = new Team(project.workspaceId);
      const teamInstance = await team.findByUserId(user.id);

      /**
       * Return null if user is not in workspace or is not admin
       */
      if (!teamInstance || teamInstance.isPending) {
        return null;
      }

      const factory = new UserInProject(user.id, project.id);
      const personalSettings = await factory.getPersonalNotificationsSettings();

      if (personalSettings) {
        return personalSettings;
      }

      const fullUserInfo = await User.findById(user.id);

      return Notify.getDefaultNotify(fullUserInfo.email);
    },

    /**
     * Get common notifications settings. Only for admins.
     * @param {ProjectSchema} project
     * @param {object} _args - query args (empty for this query)
     * @param user - current authorized user {@see ../index.js}
     * @returns {Promise<NotificationSettingsSchema>}
     */
    async commonNotificationsSettings(project, _args, { user }) {
      const team = new Team(project.workspaceId);
      const teamInstance = await team.findByUserId(user.id);

      /**
       * Return null if user is not in workspace or is not admin
       */
      if (!teamInstance || teamInstance.isPending || !teamInstance.isAdmin) {
        return null;
      }

      if (project.commonNotificationsSettings) {
        return project.commonNotificationsSettings;
      }

      return Notify.getDefaultNotify();
    },
  },
};
