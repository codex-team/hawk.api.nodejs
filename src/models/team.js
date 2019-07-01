const mongo = require('../mongo');

/**
 * @typedef {Object} TeamDocumentSchema
 * @property {string} id - document's id
 * @property {ObjectID} userId - team member id
 */

/**
 * Team model
 * The class representing Workspace-->User relationship
 */
class Team {
  /**
   * Creates Team model instance
   * @param {String} workspaceId - workspace id associated with the team
   */
  constructor(workspaceId) {
    this.workspaceId = workspaceId;
  }

  /**
   * Model's collection
   * @return {Collection}
   */
  get collection() {
    return mongo.databases.hawk.collection('team:' + this.workspaceId);
  }

  /**
   * Adds new member to the workspace team
   * @param {String} memberId - user's id to add
   * @returns {Promise<TeamDocumentSchema>} - added document
   */
  async addMember(memberId) {
    const documentId = (await this.collection.insertOne({
      userId: memberId
    })).insertedId;

    return {
      id: documentId,
      userId: memberId
    };
  }
}

module.exports = Team;
