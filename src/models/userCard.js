const mongo = require('../mongo');
const Model = require('./model');
const { ObjectID } = require('mongodb');

/**
 * @typedef {Object} UserCardSchema
 * @property {string} userId - user's id
 * @property {string} pan - card's pan
 * @property {Number} rebillId - card's rebill id for recurrent payments
 * @property {string} expDate - card's expiration date
 */

/**
 * UserCard model
 */
class UserCard extends Model {
  /**
   * Creates userCard instance
   * @param {UserSchema} userCardData - user's card data
   */
  constructor(userCardData) {
    super();
    this.userId = userCardData.userId;
    this.pan = userCardData.pan;
    this.rebillId = userCardData.rebillId;
    this.cardId = userCardData.cardId;
    this.expDate = userCardData.expDate;
  }

  /**
   * Model's collection
   * @return {Collection}
   */
  static get collection() {
    return mongo.databases.hawk.collection('userCard');
  }

  /**
   * Get all user's cards
   * @param {string} userId - user's id
   * @return {Promise<User>}
   */
  static async findByUserId(userId) {
    return (await this.collection.find({ userId })).toArray();
  }

  /**
   * Get card info
   * @param {string} userId - user's id
   * @param {Number} cardId - card's id
   * @return {Promise<UserCard>}
   */
  static async find(userId, cardId) {
    return this.collection.findOne({ userId: new ObjectID(userId), cardId });
  }

  /**
   * Creates new UserCard in DB
   * @param {UserCardSchema} userCardData - user's card data
   * @returns {Promise<User>} - user details
   */
  static async create(userCardData) {
    await this.collection.insertOne(userCardData);

    return new UserCard(userCardData);
  }

  /**
   * Remove UserCard from DB
   * @param {Number} cardNumber - user's card number
   * @param {string} userId - user's ID
   * @returns {Promise<Object>} - remove result
   */
  static async remove({ cardNumber, userId }) {
    return this.collection.deleteOne({ cardNumber, userId });
  }
}

module.exports = UserCard;
