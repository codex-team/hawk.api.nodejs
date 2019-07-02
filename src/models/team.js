const mongo = require('../mongo');
const { ObjectID } = require('mongodb');
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
      userId: new ObjectID(memberId)
    })).insertedId;

    return {
      id: documentId,
      userId: memberId
    };
  }

  /**
   * Returns all users data in the team
   * @return {Promise<User[]>}
   */
  getAllUsers() {
    return this.collection.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'users'
        }
      },
      {
        $unwind: '$users'
      },
      {
        $replaceRoot: {
          newRoot: '$users'
        }
      },
      {
        $addFields: {
          id: '$_id'
        }
      }
    ]).toArray();
  }
}

module.exports = Team;
