const mongo = require('../mongo');

/**
 * @typedef {Object} WorkspaceSchema
 * @property {string} id - workspace's id
 * @property {string} name - workspace's name
 * @property {string} [description] - workspace's description
 * @property {string} [image] - workspace's picture URL
 */

/**
 * Workspace model
 */
class Workspace {
  /**
   * Creates Workspace instance
   * @param {WorkspaceSchema} workspaceData - workspace's data
   */
  constructor(workspaceData) {
    this.id = workspaceData.id;
    this.name = workspaceData.name;
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
      ...workspaceData
    });
  }
}

module.exports = Workspace;
