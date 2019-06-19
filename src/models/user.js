const mongoose = require('mongoose');
const deepPopulate = require('mongoose-deep-populate')(mongoose);
const argon2 = require('argon2');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

require('./workspace');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true
  },
  password: {
    type: String
  },
  name: {
    type: String
  },
  picture: {
    type: String,
    default: ''
  },
  workspaces: [
    {
      type: mongoose.Schema.ObjectId, ref: 'Workspace'
    }
  ]
});

userSchema.plugin(deepPopulate);

/**
 * Creates new user in DB
 * @param {String} email - user email
 * @returns {Promise<User>} - user details
 */
userSchema.statics.create = async function (email) {
  // @todo do normal password generation
  const generatedPassword = crypto.randomBytes(8).toString('hex');
  const hashedPassword = await argon2.hash(generatedPassword);
  const userData = { email, password: hashedPassword };
  const user = new User(userData);

  await user.save();
  user.generatedPassword = generatedPassword;

  return user;
};

/**
 * @typedef {Object} Tokens
 * @property {string} accessToken - user's access token
 * @property {string} refreshToken - user's refresh token for getting new tokens pair
 */

/**
 * Generates JWT
 * @returns {Tokens} - generated Tokens pair
 */
userSchema.methods.generateTokensPair = async function () {
  const accessToken = await jwt.sign({
    userId: this._id
  }, process.env.JWT_SECRET, { expiresIn: '15m' });

  const refreshToken = await jwt.sign({
    userId: this._id
  }, process.env.JWT_SECRET, { expiresIn: '30d' });

  return { accessToken, refreshToken };
};

/**
 * Compare Password
 * @param {String} password - non-hashed password
 * @returns {Promise<boolean>} - compare result
 * */
userSchema.methods.comparePassword = function (password) {
  return argon2.verify(this.password, password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
