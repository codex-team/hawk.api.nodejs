const Model = require('./model');
const mongo = require('../mongo');
const { ObjectID } = require('mongodb');

/**
 * Model representing transaction object
 *
 * @typedef {object} Transaction
 * @property {string} id - transaction id
 * @property {string} type - transaction type ('income' or 'charge')
 * @property {number} amount - transaction amount
 * @property {Workspace} workspace - workspace for which transaction has been proceed
 * @property {number} date - transaction date
 * @property {User} user - user by whom transaction has been made (income transactions only)
 * @property {number} cardPan - PAN of card by which transaction was made (income transactions only)
 */
class Transaction extends Model {
  /**
   * Model's collection
   * @return {Collection}
   */
  static get collection() {
    return mongo.databases.hawk.collection('transactions');
  }

  /**
   * @constructor
   * @param {Transaction} transactionData
   */
  constructor(transactionData) {
    super();

    const { type, amount, workspace, date, user, cardPan, _id } = transactionData;

    this.id = _id.toString();
    this.type = type;
    this.amount = amount;
    this.workspace = workspace;
    this.date = date;
    this.user = user;
    this.cardPan = cardPan;
  }

  /**
   * Return transactions for passed workspaces
   *
   * @param {string[]} ids - ids of workspaces
   * @returns {Promise<Transaction>}
   */
  static async getWorkspacesTransactions(ids) {
    const pipeline = [
      {
        $match: {
          workspaceId: { $in: ids.map(id => new ObjectID(id)) }
        }
      },
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
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          'workspace.id': '$workspace._id',
          'user.id': '$user._id',
          workspaceId: '$$REMOVE',
          userId: '$$REMOVE'
        }
      },
      {
        $sort: {
          date: -1
        }
      }
    ];

    const docs = await this.collection.aggregate(pipeline).toArray();

    return docs.map(doc => {
      if (doc.type !== 'income') {
        delete doc.user;
      }

      return new Transaction(doc);
    });
  }
}

module.exports = Transaction;
