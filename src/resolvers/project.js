const { ValidationError } = require('apollo-server-express');
const Membership = require('../models/membership');
const { Project, ProjectToWorkspace } = require('../models/project');

/**
 * See all types and fields here {@see ../typeDefs/workspace.graphql}
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
     * @param {GraphQLResolveInfo} info - Apollo's resolver info argument {@see ./index.js}
     * @return {Project[]}
     */
    async createProject(_obj, { workspaceId, name }, { user }, _info) {
      // Check workspace ID
      const workspace = await new Membership(user.id).getWorkspaces([
        workspaceId
      ]);

      if (!workspace) {
        throw new ValidationError('No such workspace');
      }

      const project = await Project.create({ name });

      // Create Project to Workspace relationship
      new ProjectToWorkspace(workspaceId).create({ projectId: project.id });

      return project;
    }
  }
};
