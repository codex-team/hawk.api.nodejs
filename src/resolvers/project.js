const { ApolloError, UserInputError } = require('apollo-server-express');
const Validator = require('../utils/validator');
const { Project, ProjectToWorkspace } = require('../models/project.js');
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

      const project = await Project.create(options);

      // Create Project to Workspace relationship
      new ProjectToWorkspace(workspaceId).add({ projectId: project.id });

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

      const project = await Project.findById(id);

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
        await Project.updateProject(project.id, options);
      } catch (err) {
        throw new ApolloError('Something went wrong');
      }

      const updatedProject = await Project.findById(id);

      return updatedProject;
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
     *
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
  },
};
