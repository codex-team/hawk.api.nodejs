const mongo = require('../mongo');

/**
 * @typedef {Object} TeamSchema
 * @property {string} id - workspace's id
 * @property {string} [name] - workspace's name
 * @property {string} [picture] - workspace's picture URL
 */

/**
 * Workspace model
 */
class Workspace {
  /**
   * Creates Workspace instance
   * @param {TeamSchema} workspaceData - workspace's data
   */
  constructor(workspaceData) {
    this.id = workspaceData.id;
    this.name = workspaceData.name;
    this.picture = workspaceData.picture;
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
   * @param {TeamSchema} workspaceData - workspace's data
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
