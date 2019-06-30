const argon2 = require('argon2');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongo = require('../mongo');
const mongodbDriver = require('mongodb');
const ObjectID = mongodbDriver.ObjectID;

/**
 * @typedef {Object} TokensPair
 * @property {string} accessToken - user's access token
 * @property {string} refreshToken - user's refresh token for getting new tokens pair
 */

/**
 * @typedef {Object} UserSchema
 * @property {string} id - user's id
 * @property {string} email - user's email
 * @property {string} password - user's password
 * @property {string} [picture] - user's picture URL
 * @property {string} [name] - user's name
 * @property {string} [generatedPassword] - user's original password (this field appears only after registration)
 */

/**
 * User model
 */
class User {
  /**
   * Creates User instance
   * @param {UserSchema} userData - user's data
   */
  constructor(userData) {
    this.id = userData.id;
    this.password = userData.password;
    this.email = userData.email;
    this.name = userData.name;
    this.picture = userData.picture;
  }

  /**
   * Model's collection
   * @return {Collection}
   */
  static get collection() {
    return mongo.databases.hawk.collection('users');
  }

  /**
   * Creates new user in DB
   * @param {String} email - user email
   * @returns {Promise<User>} - user details
   */
  static async create(email) {
    // @todo normal password generation
    const generatedPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await argon2.hash(generatedPassword);

    const userData = { email, password: hashedPassword };
    const userId = (await this.collection.insertOne(userData)).insertedId;

    const user = new User({
      id: userId,
      ...userData
    });

    user.generatedPassword = generatedPassword;

    return user;
  }

  /**
   * Finds user by his id
   * @param {User.id} id - user's id
   * @return {Promise<User>}
   */
  static async findById(id) {
    const searchResult = await this.collection.findOne({ _id: new ObjectID(id) });

    return new User({
      id: searchResult._id,
      password: searchResult.password,
      email: searchResult.email,
      name: searchResult.name,
      picture: searchResult.picture
    });
  }

  /**
   * Finds user by his email
   * @param {User.id} email - user's email
   * @return {Promise<User>}
   */
  static async findByEmail(email) {
    const searchResult = await this.collection.findOne({ email });

    if (!searchResult) return null;

    return new User({
      id: searchResult._id,
      password: searchResult.password,
      email: searchResult.email,
      name: searchResult.name,
      picture: searchResult.picture
    });
  }

  /**
   * Generates JWT
   * @returns {TokensPair} - generated Tokens pair
   */
  async generateTokensPair() {
    const accessToken = await jwt.sign({
      userId: this.id
    }, process.env.JWT_SECRET, { expiresIn: '15m' });

    const refreshToken = await jwt.sign({
      userId: this.id
    }, process.env.JWT_SECRET, { expiresIn: '30d' });

    return { accessToken, refreshToken };
  };

  /**
   * Compare unhashed password with user's password
   * @param {String} password - password to check
   * @return {Promise<boolean>}
   */
  async comparePassword(password) {
    return argon2.verify(this.password, password);
  };
}

module.exports = User;
