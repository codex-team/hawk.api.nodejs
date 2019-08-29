const crypto = require('crypto');
const User = require('../models/user');
const Membership = require('../models/membership');

const EmailCompany = process.env.BILLING_COMPANY_EMAIL;
const OSNTaxation = 'osn';
const TaxNone = 'none';
const PaymentDescription = 'Deposit for Hawk.so';

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
      Description: PaymentDescription,
      Receipt: {
        Email: userData.email,
        EmailCompany,
        Taxation: OSNTaxation,
        Items: [ {
          Name: 'Deposit',
          Price: paymentRequest.amount,
          Quantity: 1,
          Amount: paymentRequest.amount,
          Tax: TaxNone
        } ]
      },
      PayType: 'T',
      DATA: paymentRequest.data
    };
  }

  /**
   * Generate unique payment Id
   * @return {string}
   */
  static generateOrderId() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Create new payment
   * @param {String} userId - user's id
   * @param {Object} paymentQuery - payment query params
   * @returns {Object} - payment object
   */
  static async create(userId, paymentQuery) {
    const orderId = this.generateOrderId();
    const userData = await User.findById(userId);
    const membership = await new Membership(userId).getWorkspaces([ paymentQuery.workspaceId ]);

    if (membership.length !== 1) {
      throw Error('Invalid workspaceId');
    }

    return PaymentRequest.generatePaymentObject(paymentQuery, userData, orderId);
  }
}

module.exports = PaymentRequest;
