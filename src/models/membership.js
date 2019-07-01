const mongo = require('../mongo');

/**
 * @typedef {Object} MembershipDocumentSchema
 * @property {string} id - document's id
 * @property {ObjectID} workspaceId - user workspace id
 */

/**
 * Membership model
 * The class provides the opportunity to work with the collections of the user's membership list
 */
class Membership {
  /**
   * Creates Membership model instance
   * @param {String} userId - workspace member id
   */
  constructor(userId) {
    this.userId = userId;
  }

  /**
   * Model's collection
   * @return {Collection}
   */
  get collection() {
    return mongo.databases.hawk.collection('membership:' + this.userId);
  }

  /**
   * Adds new workspace to the user's membership list
   * @param {String} workspaceId - user's id to add
   * @returns {Promise<TeamDocumentSchema>} - created document
   */
  async addWorkspace(workspaceId) {
    const documentId = (await this.collection.insertOne({
      workspaceId: workspaceId
    })).insertedId;

    return {
      id: documentId,
      workspaceId
    };
  }
}

module.exports = Membership;
