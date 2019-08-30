const { ValidationError } = require('apollo-server-express');
const { ObjectID } = require('mongodb');
const Membership = require('../models/membership');
const { Project, ProjectToWorkspace } = require('../models/project');
const eventResolvers = require('./event');

/**
 * See all types and fields here {@see ../typeDefs/project.graphql}
 */
module.exports = {
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

      const project = await Project.create({
        name,
        uidAdded: new ObjectID(user.id)
      });

      // Create Project to Workspace relationship
      new ProjectToWorkspace(workspaceId).add({ projectId: project.id });

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

      return result[0];
    }
  }
};
