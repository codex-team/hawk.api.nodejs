const crypto = require('crypto');
const User = require('../models/user');
const TinkoffAPI = require('tinkoff-api');

const EmailCompany = process.env.BILLING_COMPANY_EMAIL;
const OSNTaxation = 'osn';
const TaxNone = 'none';
const PaymentDescription = 'Card check payment. It will be refunded.';
const bankApi = new TinkoffAPI(process.env.TINKOFF_TERMINAL_KEY, process.env.TINKOFF_SECRET_KEY);

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
  static generatePaymentObject(paymentRequest, userData) {
    return {
      Amount: paymentRequest.amount,
      OrderId: paymentRequest.orderId,
      Recurrent: paymentRequest.recurrent,
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
    const userData = await User.findById(userId);
    const paymentObject = PaymentRequest.generatePaymentObject(paymentQuery, userData);

    console.log('INIT =>', paymentObject);
    return paymentObject;
  }

  /**
   * Run API Init action
   * @param userId
   * @param paymentInitQuery
   * @return {Promise<void>}
   */
  static async apiInitPayment(userId, paymentInitQuery) {
    const paymentRequest = await PaymentRequest.create(userId, paymentInitQuery);
    const result = await bankApi.initPayment(paymentRequest);

    console.log(`Got result for Init payment: ${JSON.stringify(result)}`);
    if (!result.Success) {
      throw Error(`Merchant API error: ${result.Message} ${result.Details}`);
    }
    return result;
  }
}

module.exports = PaymentRequest;
