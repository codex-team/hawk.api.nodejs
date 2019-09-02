const argon2 = require('argon2');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongo = require('../mongo');
const mongodbDriver = require('mongodb');
const ObjectID = mongodbDriver.ObjectID;
const Model = require('./model');
const objectHasOnlyProps = require('../utils/objectHasOnlyProps');

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
 * @property {string} [image] - user's image URL
 * @property {string} [name] - user's name
 * @property {string} [generatedPassword] - user's original password (this field appears only after registration)
 * @property {object} [github] - github authn data
 * @property {number} [github.id] - github id
 * @property {string} [github.login] - github login
 * @property {string} [github.email] - github email
 * @property {object} [google] - google authn data
 * @property {number} [google.id] - google id
 * @property {string} [google.login] - google login
 * @property {string} [google.email] - google email
 */

/**
 * User model
 */
class User extends Model {
  /**
   * Creates User instance
   * @param {UserSchema} userData - user's data
   */
  constructor(userData) {
    super();
    this.id = userData.id;
    this.password = userData.password;
    this.email = userData.email;
    this.name = userData.name;
    this.image = userData.image;
    this.githubId = userData.githubId;
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
   * @param {UserSchema} userData - user email
   * @param {boolean} generatePassword - generate password
   * @returns {Promise<User>} - user details
   */
  static async create(userData, { generatePassword }) {
    generatePassword = generatePassword || true;
    // @todo normal password generation
    const generatedPassword = await this.generatePassword();

    if (generatePassword) {
      userData.password = await this.hashPassword(generatedPassword);
    }
    const userId = (await this.collection.insertOne(userData)).insertedId;

    const user = new User({
      id: userId,
      ...userData
    });

    user.generatedPassword = generatedPassword;

    return user;
  }

  /**
   * Generate 16bytes password
   *
   * @returns {Promise<String>}
   */
  static generatePassword() {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(8, (err, buff) => {
        if (err) return reject(err);
        resolve(buff.toString('hex'));
      });
    });
  }

  /**
   * Hash password
   *
   * @param {String} password
   * @returns {Promise<string>}
   */
  static async hashPassword(password) {
    return argon2.hash(password);
  }

  /**
   * Change user's password
   * Hashes new password and updates the document
   *
   * @param {string|ObjectID} userId - user ID
   * @param {string} newPassword - new user password
   * @returns {Promise<void>}
   */
  static async changePassword(userId, newPassword) {
    const hashedPassword = await this.hashPassword(newPassword);

    const status = await this.update(
      { _id: new ObjectID(userId) },
      { password: hashedPassword }
    );

    if (status !== 1) {
      throw new Error('Can\'t change password');
    }
  }

  /**
   * Update user profile data
   *
   * @param {string|ObjectID} userId - user ID
   * @param {Object} user – user object
   * @returns {Promise<void>}
   */
  static async updateProfile(userId, user) {
    if (!await objectHasOnlyProps(user, { name: true, email: true, image: true })) {
      throw new Error('User object has invalid properties\'');
    }

    try {
      await this.update(
        { _id: new ObjectID(userId) },
        user
      );
    } catch (e) {
      throw new Error('Can\'t update profile');
    }
  }

  /**
   * Finds user by his email
   * @param {User.email} email - user's email
   * @return {Promise<User>}
   */
  static async findByEmail(email) {
    const searchResult = await this.collection.findOne({ email });

    if (!searchResult) return null;

    return new User({
      id: searchResult._id,
      ...searchResult
    });
  }

  /**
   * Generates JWT
   * @returns {TokensPair} - generated Tokens pair
   */
  async generateTokensPair() {
    const accessToken = await jwt.sign(
      {
        userId: this.id
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = await jwt.sign(
      {
        userId: this.id
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Compare unhashed password with user's password
   * @param {String} password - password to check
   * @return {Promise<boolean>}
   */
  async comparePassword(password) {
    return argon2.verify(this.password, password);
  }
}

module.exports = User;
