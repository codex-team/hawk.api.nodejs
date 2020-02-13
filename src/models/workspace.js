const mongo = require('../mongo');
const mongodbDriver = require('mongodb');
const ObjectID = mongodbDriver.ObjectID;
const Model = require('./model');
const objectHasOnlyProps = require('../utils/objectHasOnlyProps');

/**
 * @typedef {Object} WorkspaceSchema
 * @property {string} id - workspace's id
 * @property {string} name - workspace's name
 * @property {int} balance - workspace's account balance in kopecs
 * @property {Plan} balance - workspace's plan
 * @property {string} [description] - workspace's description
 * @property {string} [image] - workspace's image URL
 */

/**
 * Workspace model
 */
class Workspace extends Model {
  /**
   * Creates Workspace instance
   * @param {WorkspaceSchema} workspaceData - workspace's data
   */
  constructor(workspaceData) {
    super();
    this.id = workspaceData.id;
    this.name = workspaceData.name;
    this.balance = workspaceData.balance;
    this.plan = workspaceData.plan;
    this.image = workspaceData.image;
    this.description = workspaceData.description;
  }

  /**
   * Model's collection
   * @return {Collection}
   */
  static get collection() {
    return mongo.databases.hawk.collection('workspaces');
  }

  /**
   * Creates new workspace in DB
   * @param {WorkspaceSchema} workspaceData - workspace's data
   * @returns {Promise<Workspace>} - created workspace
   */
  static async create(workspaceData) {
    const workspaceId = (await this.collection.insertOne(workspaceData)).insertedId;

    return new Workspace({
      id: workspaceId,
      ...workspaceData,
    });
  }

  /**
   * Update workspace data
   *
   * @param {string|ObjectID} workspaceId - workspace ID
   * @param {Workspace} workspace – workspace data
   * @returns {Promise<void>}
   */
  static async updateWorkspace(workspaceId, workspace) {
    if (!await objectHasOnlyProps(workspace, {
      name: true,
      description: true,
      image: true,
    })) {
      throw new Error('User object has invalid properties\'');
    }

    try {
      await this.update(
        { _id: new ObjectID(workspaceId) },
        workspace
      );
    } catch (e) {
      throw new Error('Can\'t update workspace');
    }
  }
}

module.exports = Workspace;
