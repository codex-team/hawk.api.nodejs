const mongo = require('../mongo');

/**
 * @typedef {Object} MembershipDocumentSchema
 * @property {string} id - document's id
 * @property {ObjectID} workspaceId - user workspace id
 */

/**
 * Membership model
 * The class representing User-->Workspace relationship
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

  async getAllWorkspaces() {
    const res = this.collection.aggregate([
      {
        $lookup: {
          from: 'workspaces',
          localField: 'workspaceId',
          foreignField: '_id',
          as: 'workspace'
        }
      },
      {
        $unwind: '$workspace'
      },
      {
        $replaceRoot: {
          newRoot: '$workspace'
        }
      },
      {
        $addFields: {
          id: '$_id'
        }
      }
    ]);

    return res.toArray();
  }
}

module.exports = Membership;
