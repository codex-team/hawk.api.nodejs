const mongo = require('../mongo');
const { ObjectID } = require('mongodb');
const { sign } = require('jsonwebtoken');

/**
 * @typedef {Object} ProjectSchema
 * @typedef {string|ObjectID} id - project id
 * @property {string} [token] - project token
 * @property {string} name - project name
 * @property {string} [description] - project description
 * @property {string} [domain] - project domain
 * @property {string} [logo] - project logo
 * @property {string|ObjectID} [uidAdded] - user who added the project
 */

/**
 * @typedef {Object} NotifyProvider
 * @property {boolean} enabled - is notifications enabled
 * @property {string} value - hook or email
 */

/**
 * @typedef {Object} ProjectToWorkspaceSchema
 * @property {string|ObjectID} id - ProjectWorkspace ID
 * @property {string|ObjectID} projectId - project ID
 * @property {string} [projectUri] - project unique URI
 * @property {Object} [notifies] - notification settings
 * @property {NotifyProvider} [notifies.email]
 * @property {NotifyProvider} [notifies.tg]
 * @property {NotifyProvider} [notifies.slack]
 */

/**
 * Project model
 */
class Project {
  /**
   * Create Project instance
   *
   * @param {ProjectSchema} projectData
   */
  constructor(projectData) {
    if (!projectData) {
      throw new Error(
        'Can not construct Project model, because projectData is not provided'
      );
    }

    this.id = projectData.id;
    this.token = projectData.token;
    this.name = projectData.name;
    this.description = projectData.description;
    this.domain = projectData.domain;
    this.uri = projectData.uri;
    this.logo = projectData.logo;
    this.uidAdded = projectData.uidAdded;
    this.createdAt = projectData.createdAt;
  }

  /**
   * Project's collection
   *
   * @returns {Collection}
   */
  static get collection() {
    return mongo.databases.hawk.collection('projects');
  }

  /**
   * Creates new project in DB
   * @param {ProjectSchema} projectData
   * @returns {Promise<Project>}
   */
  static async create(projectData) {
    /**
     * @todo Make transaction for creating project
     */
    const projectId = (await this.collection.insertOne(projectData)).insertedId;

    const token = await sign({ projectId }, process.env.JWT_SECRET_EVENTS);

    await this.collection.updateOne({ _id: projectId }, { $set: { token } });

    return new Project({
      id: projectId,
      token,
      ...projectData
    });
  }

  /**
   * Finds project
   *
   * @param {object} [query={}] - query
   * @param {number} [limit=10] - query limit
   * @param {number} [skip=0] - query skip
   * @returns {Promise<ProjectSchema[]>} - projects matching query
   */
  static async find(query = {}, limit = 10, skip = 0) {
    const cursor = this.collection
      .find(query)
      .limit(limit)
      .skip(skip);

    // Memory overflow?
    return (await cursor.toArray()).map(
      project => new Project({ id: project._id, ...project })
    );
  }

  /**
   * Finds project by ID
   *
   * @param {string|ObjectID} projectId
   * @returns {Promise<null|ProjectSchema>}
   */
  static async findById(projectId) {
    const project = await this.collection.findOne({
      _id: new ObjectID(projectId)
    });

    if (!project) {
      return null;
    }

    return new Project({
      id: project._id,
      ...project
    });
  }
}

/**
 * ProjectWorkspace model
 * Represents Project-Workspace relationship
 */
class ProjectToWorkspace {
  /**
   * Creates an instance of ProjectToWorkspace
   * @param {string|ObjectID} workspaceId
   */
  constructor(workspaceId) {
    this.workspaceId = new ObjectID(workspaceId);
    this.collection = mongo.databases.hawk.collection(
      'projects:' + workspaceId
    );
  }

  /**
   * Find ProjectWorkspace
   *
   * @param {object} [query={}] - query
   * @param {number} [limit=10] - query limit
   * @param {number} [skip=0] - query skip
   * @returns {Promise<ProjectToWorkspaceSchema[]>}
   */
  async find(query = {}, limit = 10, skip = 0) {
    const cursor = this.collection
      .find(query)
      .limit(limit)
      .skip(skip);

    return (await cursor.toArray()).map(projectWorkspace => ({
      id: projectWorkspace._id,
      ...projectWorkspace
    }));
  }

  /**
   * Find projectWorkspace by ID
   *
   * @param {string|ObjectID} projectWorkspaceId
   * @returns {Promise<null|ProjectToWorkspaceSchema>}
   */
  async findById(projectWorkspaceId) {
    const projectWorkspace = await this.collection.findOne({
      _id: new ObjectID(projectWorkspaceId)
    });

    if (!projectWorkspace) {
      return null;
    }

    return {
      id: projectWorkspace._id,
      ...projectWorkspace
    };
  }

  /**
   * Creates new projects:<workspace._id> document
   *
   * @param {ProjectToWorkspaceSchema} projectToWorkspaceData
   * @returns {Promise<Object>}
   */
  async create(projectToWorkspaceData) {
    const projectToWorkspace = await this.collection.insertOne(
      projectToWorkspaceData
    );

    return {
      id: projectToWorkspace.insertedId,
      ...projectToWorkspace
    };
  }

  /**
   * Gets projects in workspace.
   * If ids were not passed, returns all projects in workspace.
   *
   * @param {string[]|ObjectID[]} ids - project(s) id(s)
   * @returns {ProjectSchema[]}
   */
  async getProjects(ids = []) {
    ids = ids.map(id => new ObjectID(id));

    const pipleine = [
      {
        $lookup: {
          from: 'projects',
          localField: 'projectId',
          foreignField: '_id',
          as: 'project'
        }
      },
      {
        $unwind: '$project'
      },
      {
        $replaceRoot: {
          newRoot: '$project'
        }
      },
      {
        $addFields: {
          id: '$_id'
        }
      }
    ];

    if (ids.length) {
      return this.collection
        .aggregate([
          {
            $match: {
              projectId: {
                $in: ids
              }
            }
          },
          ...pipleine
        ])
        .toArray();
    }
    return this.collection.aggregate(pipleine).toArray();
  }
}

module.exports = {
  Project,
  ProjectToWorkspace
};
