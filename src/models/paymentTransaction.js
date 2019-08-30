const mongo = require('../mongo');
const Model = require('./model');

/**
 * @typedef {Object} PaymentTransaction
 * @property {string} id - transaction unique id
 * @property {string} userId - user id
 * @property {string} workspaceId - workspace id
 * @property {number} amount - payment amount in kopecs
 * @property {string} orderId - order id (local)
 * @property {string} paymentId - payment id (Tinkoff side)
 * @property {number} timestamp - create timestamp
 */

/**
 * PaymentTransaction model
 */
class PaymentTransaction extends Model {
  /**
   * Creates PaymentTransaction instance
   * @param {PaymentTransaction} transactionData - transaction data
   */
  constructor(transactionData) {
    super();
    this.id = transactionData.id;
    this.userId = transactionData.userId;
    this.workspaceId = transactionData.workspaceId;
    this.amount = transactionData.amount;
    this.orderId = transactionData.orderId;
    this.paymentId = transactionData.paymentId;
    this.timestamp = transactionData.timestamp;
    this.status = transactionData.status;
  }

  /**
   * Model's collection
   * @return {Collection}
   */
  static get collection() {
    return mongo.databases.hawk.collection('paymentTransactions');
  }

  /**
   * Creates new payment transaction
   * @param {PaymentTransaction} transactionData - transaction data
   * @returns {Promise<PaymentTransaction>} - created transaction
   */
  static async create(transactionData) {
    return new PaymentTransaction(transactionData);
  }
}

module.exports = PaymentTransaction;
