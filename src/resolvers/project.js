const { ApolloError, UserInputError } = require('apollo-server-express');
const Validator = require('../utils/validator');
const ProjectToWorkspace = require('../models/projectToWorkspace.js');
const UserInProject = require('../models/userInProject');
const EventsFactory = require('../models/eventsFactory');

/**
 * See all types and fields here {@see ../typeDefs/project.graphql}
 */
module.exports = {
  Query: {
    /**
     * Returns project's Model
     * @param {ResolverObj} _obj
     * @param {String} id - project id
     * @param {ContextFactories} factories - factories for working with models
     * @return {Promise<ProjectDBScheme>}
     */
    async project(_obj, { id }, { factories }) {
      return factories.projectsFactory.findById(id);
    },
  },
  Mutation: {
    /**
     * Creates project
     *
     * @param {ResolverObj} _obj
     * @param {string} workspaceId - workspace ID
     * @param {string} name - project name
     * @param {string} image - project logo
     * @param {UserInContext} user - current authorized user {@see ../index.js}
     * @param {ContextFactories} factories - factories for working with models
     * @return {Project[]}
     */
    async createProject(_obj, { workspaceId, name, image }, { user, factories }) {
      const workspace = await factories.workspacesFactory.findById(workspaceId);

      if (!workspace) {
        throw new UserInputError('No such workspace');
      }

      const options = {
        name,
        workspaceId,
        uidAdded: user.id,
        image,
      };

      const project = await factories.projectsFactory.create(options);

      return project;
    },

    /**
     * Update project settings
     *
     * @param {ResolverObj} _obj
     * @param {string} projectId - id of the updated project
     * @param {string} name - project name
     * @param {string} description - project description
     * @param {string} - project logo
     * @param {UserInContext} user - current authorized user {@see ../index.js}
     * @param {ContextFactories} factories - factories for working with models
     *
     * @returns {Project}
     */
    async updateProject(_obj, { id, name, description, image }, { user, factories }) {
      if (!Validator.string(name)) {
        throw new UserInputError('Invalid name length');
      }

      if (!Validator.string(description, 0)) {
        throw new UserInputError('Invalid description length');
      }

      const project = await factories.projectsFactory.findById(id);

      if (!project) {
        throw new ApolloError('There is no project with that id');
      }

      try {
        const options = {
          name,
          description,
        };

        if (image) {
          options.image = image;
        }

        return project.updateProject(options);
      } catch (err) {
        throw new ApolloError('Something went wrong');
      }
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
     * @param {ProjectDBScheme} project - result of parent resolver
     * @param {String} eventId - event's identifier
     *
     * @returns {Event}
     */
    async event(project, { id: eventId }) {
      const factory = new EventsFactory(project._id);
      const event = await factory.findById(eventId);

      event.projectId = project._id;

      return event;
    },

    /**
     * Find project events
     *
     * @param {ProjectDBScheme} project - result of parent resolver
     * @param {number} limit - query limit
     * @param {number} skip - query skip
     * @param {Context.user} user - current authorized user {@see ../index.js}
     * @returns {Event[]}
     */
    async events(project, { limit, skip }) {
      const factory = new EventsFactory(project._id);

      return factory.find({}, limit, skip);
    },

    /**
     * Returns events count that wasn't seen on project
     *
     * @param {ProjectDBScheme} project - result of parent resolver
     * @param {Object} data - additional data. In this case it is empty
     * @param {User} user - authorized user
     *
     * @return {Promise<number>}
     */
    async unreadCount(project, data, { user }) {
      const eventsFactory = new EventsFactory(project._id);
      const userInProject = new UserInProject(user.id, project._id);
      const lastVisit = await userInProject.getLastVisit();

      return eventsFactory.getUnreadCount(lastVisit);
    },

    /**
     * Returns recent Events grouped by day
     *
     * @param {ProjectDBScheme} project - result of parent resolver
     * @param {Number} limit - limit for events count
     * @param {Number} skip - certain number of documents to skip
     *
     * @return {Promise<RecentEventSchema[]>}
     */
    async recentEvents(project, { limit, skip }) {
      const factory = new EventsFactory(project._id);

      return factory.findRecent(limit, skip);
    },
  },
};
