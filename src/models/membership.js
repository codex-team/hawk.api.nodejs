const mongo = require('../mongo');
const { ObjectID } = require('mongodb');

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

  /**
   * Get user's workspaces by ids
   * Returns all user's workspaces if ids = []
   * @param {string[]} [ids = []] - workspaces ids
   * @return {Promise<Workspace[]>}
   */
  async getWorkspaces(ids = []) {
    ids = ids.map(id => new ObjectID(id));

    const pipeline = [
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
      } ];

    if (ids.length) {
      return this.collection.aggregate([
        { $match: {
          workspaceId: {
            $in: ids
          }
        }
        },
        ...pipeline
      ]).toArray();
    }
    return this.collection.aggregate(pipeline).toArray();
  }
}

module.exports = Membership;
