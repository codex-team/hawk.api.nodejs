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
 * @property {string} [image] - user's image URL
 * @property {string} [name] - user's name
 * @property {string} [githubId] - user's GitHub profile id
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
   * @param {String} email - user email
   * @returns {Promise<User>} - user details
   */
  static async create(email) {
    // @todo normal password generation
    const generatedPassword = await this.generatePassword();
    const hashedPassword = await this.hashPassword(generatedPassword);

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
   * Creates new user id DB by GitHub provider
   * @param {string} id - GitHub profile id
   * @param {string} name - GitHub profile name
   * @param {string} picture - GitHub profile avatar url
   * @return {Promise<User>}
   */
  static async createByGithub({ id, name, picture }) {
    if (!id || !name || !picture) {
      throw new Error('Required parameters are not provided');
    }

    const userData = { githubId: id, name, picture };

    const userId = (await this.collection.insertOne(userData)).insertedId;

    const user = new User({
      id: userId,
      ...userData
    });

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
   * Update user fields
   *
   * @param {object} query - query to match
   * @param {object} data - update data
   * @returns {Promise<number>} - number of documents modified
   */
  static async update(query, data) {
    return (await this.collection.updateOne(query, { $set: data }))
      .modifiedCount;
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
      throw new Error("Can't change password");
    }
  }

  /**
   * Finds user by his id
   * @param {User.id} id - user's id
   * @return {Promise<User>}
   */
  static async findById(id) {
    const searchResult = await this.collection.findOne({
      _id: new ObjectID(id)
    });

    return new User({
      id: searchResult._id,
      ...searchResult
    });
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
   * Find user by query
   * @param {object} query - query object
   * @return {Promise<User>|null}
   */
  static async findOne(query) {
    const searchResult = await this.collection.findOne(query);

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
