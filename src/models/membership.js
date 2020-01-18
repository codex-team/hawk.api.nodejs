const mongo = require('../mongo');
const { ObjectID } = require('mongodb');

/**
 * @typedef {Object} MembershipDocumentSchema
 * @property {string} id - document's id
 * @property {ObjectID} workspaceId - user workspace id
 * @property {boolean} isPending - shows if member is pending
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
   * @param {String} isPending - if true, mark user's membership as pending
   * @returns {Promise<TeamDocumentSchema>} - created document
   */
  async addWorkspace(workspaceId, isPending = false) {
    const doc = {
      workspaceId: new ObjectID(workspaceId)
    };

    if (isPending) {
      doc.isPending = isPending;
    }

    const documentId = (await this.collection.insertOne(doc)).insertedId;

    return {
      id: documentId,
      workspaceId
    };
  }

  /**
   * Remove workspace from membership collection
   *
   * @param {string} workspaceId - id of workspace to remove
   * @returns {Promise<{workspaceId: string}>}
   */
  async removeWorkspace(workspaceId) {
    await this.collection.removeOne({
      workspaceId: new ObjectID(workspaceId)
    });

    return {
      workspaceId
    };
  }

  /**
   * Confirm membership of workspace by id
   *
   * @param {string} workspaceId - workspace id to confirm
   * @returns {Promise<void>}
   */
  async confirmMembership(workspaceId) {
    await this.collection.updateOne(
      {
        workspaceId: new ObjectID(workspaceId)
      },
      { $unset: { isPending: 1 } }
    );
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
        $match: {
          isPending: { $exists: false }
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
        $lookup: {
          from: 'plans',
          localField: 'plan.name',
          foreignField: 'name',
          as: 'planInfo'
        }
      },
      {
        $unwind: {
          path: '$planInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          id: '$_id',
          'plan.monthlyCharge': '$planInfo.monthlyCharge',
          'plan.eventsLimit': '$planInfo.eventsLimit',
          planInfo: '$$REMOVE'
        }
      }
    ];

    if (ids.length) {
      return this.collection.aggregate([
        {
          $match: {
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
