// const mongoose = require('mongoose');
const mongo = require('../mongo');
const { ObjectID } = require('mongodb');
const { sign } = require('jsonwebtoken');

/**
 * @typedef {Object} ProjectSchema
 * @typedef {string|ObjectID} [id] - project id
 * @property {string} [token] - project token
 * @property {string} name - project name
 * @property {string} [description] - project description
 * @property {string} [domain] - project domain
 * @property {string} [uri] - project uri
 * @property {string} [logo] - project logo
 * @property {string|ObjectID} [uidAdded] - user who added the project
 * @property {Date} [createdAt] - project date of creation
 */

/**
 * @typedef {Object} NotifyProvider
 * @property {boolean} enabled - is notifications enabled
 * @property {string} value - hook or email
 */

/**
 * @typedef {Object} ProjectWorkspaceSchema
 * @property {string|ObjectID} id - ProjectWorkspace ID
 * @property {string|ObjectID} projectID - project ID
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
    return mongo.databases.events.collection('projects');
  }

  /**
   * Creates new project in DB
   * @param {ProjectSchema} projectData
   * @returns {Project}
   */
  static async create(projectData) {
    /**
     * @todo Make transaction for creating project
     */
    const projectId = (await this.collection.insertOne(projectData)).insertedId;

    const token = await sign({ projectId }, process.env.JWT_SECRET_EVENTS);

    await this.collection.findOneAndUpdate({ _id: projectId }, { token });

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
   * @returns {ProjectSchema[]} - projects matching query
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
   * @returns {null|ProjectSchema}
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
class ProjectWorkspace {
  /**
   * Creates an instance of ProjectWorkspace
   * @param {string|ObjectID} workspaceId
   */
  constructor(workspaceId) {
    this.workspaceId = new ObjectID(workspaceId);
    this.collection = mongo.databases.events.collection(
      'projects:' + workspaceId
    );
  }

  /**
   * Find ProjectWorkspace
   *
   * @param {object} [query={}] - query
   * @param {number} [limit=10] - query limit
   * @param {number} [skip=0] - query skip
   * @returns {ProjectWorkspaceSchema[]}
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
   * @returns {null|ProjectWorkspaceSchema}
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
}

module.exports = {
  Project,
  ProjectWorkspace
};
