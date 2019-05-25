const mongoose = require('mongoose');
const argon2 = require('argon2');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

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
  }
});

/**
 * Creates new user in DB
 * @param {String} email - user email
 * @returns {Promise} - user details
 */
userSchema.statics.create = async function (email) {
  const generatedPassword = crypto.randomBytes(8).toString('hex');
  const hashedPassword = await argon2.hash(generatedPassword);
  const userData = { email, password: hashedPassword };
  const user = new User(userData);

  await user.save();
  user.generatedPassword = generatedPassword;

  return user;
};

/**
 * Generates JWT
 * @returns {String} - generated JWT
 */
userSchema.methods.generateJWT = function () {
  return jwt.sign({
    id: this._id
  }, process.env.JWT_SECRET, { expiresIn: '1d' });
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
