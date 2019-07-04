const { ValidationError } = require('apollo-server-express');
const Membership = require('../models/membership');
const { Project, ProjectToWorkspace } = require('../models/project');

module.exports = {
  Mutation: {
    /**
     *
     *
     * @param {*} _obj
     * @param {*} { workspaceId, name }
     * @param {*} { user }
     * @param {*} _info
     * @returns
     */
    async createProject(_obj, { workspaceId, name }, { user }, _info) {
      // Check workspace ID
      const workspace = await new Membership(user.id).getWorkspaces([
        workspaceId
      ]);

      console.log(workspace);

      if (!workspace) {
        throw new ValidationError('No such workspace');
      }

      const project = await Project.create({ name });

      console.log(project);

      // Create Project to Workspace relationship
      new ProjectToWorkspace(workspaceId).create({ projectId: project.id });

      return project;
    }
  }
};
