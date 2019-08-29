const mongo = require('../mongo');
const { ObjectID } = require('mongodb');
/**
 * @typedef {Object} TeamDocumentSchema
 * @property {string} id - document's id
 * @property {ObjectID} userId - team member id
 * @property {boolean} isPending - shows if member is pending
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
   * @param {boolean} pending - if true, mark member as pending
   * @returns {Promise<TeamDocumentSchema>} - added document
   */
  async addMember(memberId, pending = false) {
    const doc = {
      userId: new ObjectID(memberId)
    };

    if (pending) {
      doc.pending = pending;
    }

    const documentId = (await this.collection.insertOne(doc)).insertedId;

    return {
      id: documentId,
      userId: memberId
    };
  }

  /**
   * Remove member from workspace
   *
   * @param {string} memberId - id of member to remove
   * @returns {Promise<{userId: string}>}
   */
  async removeMember(memberId) {
    await this.collection.removeOne({
      userId: new ObjectID(memberId)
    });

    return {
      userId: memberId
    };
  }

  /**
   * Remove member from workspace by email
   *
   * @param {string} memberEmail - email of member to remove
   * @returns {Promise<{userId: string}>}
   */
  async removeMemberByEmail(memberEmail) {
    await this.collection.removeOne({
      userEmail: memberEmail
    });

    return {
      userEmail: memberEmail
    };
  }

  /**
   * Grant admin permissions
   *
   * @param {string} memberId - id of member to grant permissions
   * @param {boolean} state - state of permissions
   * @returns {Promise<{id: string, userId: string}>}
   */
  async grantAdmin(memberId, state = true) {
    const documentId = (await this.collection.updateOne(
      {
        userId: new ObjectID(memberId)
      },
      {
        $set: { isAdmin: state }
      }
    ));

    return {
      id: documentId,
      userId: memberId
    };
  }

  /**
   * Add unregistered member to the workspace
   *
   * @param {string} memberEmail - invited member`s email
   * @returns {Promise<{userEmail: string, id: string}>}
   */
  async addUnregisteredMember(memberEmail) {
    const foundDocument = await this.collection.findOne({ userEmail: memberEmail });

    if (foundDocument) {
      throw new Error('User is already invited to this workspace');
    }

    const documentId = (await this.collection.insertOne({
      userEmail: memberEmail,
      isPending: true
    })).insertedId;

    return {
      id: documentId,
      userEmail: memberEmail
    };
  }

  /**
   * Confirm membership of user
   *
   * @param {User} member - member to confirm
   * @returns {Promise<boolean>}
   */
  async confirmMembership(member) {
    const { matchedCount, modifiedCount } = await this.collection.updateOne(
      {
        userId: new ObjectID(member.id)
      },
      { $unset: { isPending: 1 } }
    );

    if (matchedCount > 0 && modifiedCount === 0) {
      throw new Error('User is already confirmed the invitation');
    }

    if (!matchedCount) {
      await this.collection.updateOne(
        {
          userEmail: member.email
        },
        { $set: { userId: new ObjectID(member.id) }, $unset: { userEmail: 1, isPending: 1 } }
      );

      return false;
    }

    return true;
  }

  /**
   * Returns all users data in the team
   * @return {Promise<User[]>}
   */
  getAllUsers() {
    return this.collection.aggregate([
      {
        $match: {
          isPending: { $exists: false }
        }
      },
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
          newRoot: { $mergeObjects: ['$users', { isAdmin: '$isAdmin' } ] }
        }
      },
      {
        $addFields: {
          id: '$_id',
          isPending: false
        }
      }
    ]).toArray();
  }

  /**
   * Returns all pending users
   *
   * @returns {Promise<User[]>}
   */
  getPendingUsers() {
    return this.collection.aggregate([
      {
        $match: {
          isPending: true
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'users'
        }
      },
      {
        $unwind: {
          path: '$users',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ['$users', { isPending: '$isPending', email: '$userEmail' } ]
          }
        }
      }
    ]).toArray();
  }
}

module.exports = Team;
