const mongoose = require('mongoose');
const argon2 = require('argon2');
const crypto = require('crypto');

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
 * @returns {Promise} - created user
 */
userSchema.statics.create = async function (email) {
  const generatedPassword = crypto.randomBytes(8).toString('hex');
  const hashedPassword = await argon2.hash(generatedPassword);
  const user = new this({ email, password: hashedPassword });

  return {
    ...await user.save(),
    generatedPassword
  };
};

const User = mongoose.model('User', userSchema);

module.exports = {
  User
};
