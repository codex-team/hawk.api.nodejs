const crypto = require('crypto');
const mongo = require('../mongo');
const mongodbDriver = require('mongodb');
const ObjectID = mongodbDriver.ObjectID;
const User = require('../models/user');
const Membership = require('../models/membership');

/**
 * @typedef {Object} PaymentQuery
 * @property {string} language - user's language
 * @property {int} amount - payment amount
 */

const NotificationURL = 'https://19479a33.ngrok.io/billing';
const EmailCompany = 'team@hawk.so';
const OSNTaxation = 'osn';
const TaxNone = 'none';

/**
 * PaymentRequest model
 */
class PaymentRequest {
  /**
   * Return payment request JSON object
   * @param {UserSchema} paymentRequest - user's data
   * @param {UserSchema} userData - user's data
   * @param {UserSchema} orderId - unique order identifier
   */
  static generatePaymentObject(paymentRequest, userData, orderId) {
    return {
      Amount: paymentRequest.amount,
      OrderId: orderId,
      Language: paymentRequest.language,
      CustomerKey: userData.id,
      Description: 'Deposit for Hawk.so',
      NotificationURL,
      Receipt: {
        Email: userData.email,
        EmailCompany,
        Taxation: OSNTaxation,
        Items: [ {
          Name: 'Make deposit',
          Price: paymentRequest.amount,
          Quantity: 1,
          Amount: paymentRequest.amount,
          Tax: TaxNone
        } ]
      },
      PayType: 'T'
    };
  }

  /**
   * Model's collection
   * @return {Collection}
   */
  static get collection() {
    return mongo.databases.hawk.collection('paymentRequests');
  }

  /**
   * Generate unique payment Id
   * @return {string}
   */
  static generateOrderId() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Creates new user in DB
   * @param {String} userId - user's id
   * @param {PaymentQuery} paymentQuery - payment query params
   * @returns {Object} - payment object
   */
  static async create(userId, paymentQuery) {
    const orderId = this.generateOrderId();
    const userData = await User.findById(userId);
    const membership = await new Membership(userId).getWorkspaces([ paymentQuery.workspaceId ]);

    if (membership.length !== 1) {
      throw Error('Invalid workspaceId');
    }

    // const paymentRequest = {
    //   orderId,
    //   workspaceId: paymentQuery.workspaceId,
    //   userId: userData.id,
    //   timestamp: new Date()
    // };

    // await this.collection.insertOne(paymentRequest);
    return PaymentRequest.generatePaymentObject(paymentQuery, userData, orderId);
  }

  /**
   * Add bank payment Id to the payment order
   * @param orderId - orderId in database
   * @param params - params to set
   * @return {Promise}
   */
  static async setParams(orderId, params) {
    return this.collection.updateOne({ orderId }, { $set: params });
  }

  static async findByOrderId(orderId) {
    return this.collection.findOne({ orderId });
  }
}

module.exports = PaymentRequest;
