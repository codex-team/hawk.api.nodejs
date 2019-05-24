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
 * @returns {Promise} - user details
 */
userSchema.statics.create = async function (email) {
  const generatedPassword = crypto.randomBytes(8).toString('hex');
  const hashedPassword = await argon2.hash(generatedPassword);
  const userData = { email, password: hashedPassword };
  const user = new this(userData);

  await user.save();

  return {
    ...userData,
    generatedPassword
  };
};

module.exports = mongoose.model('User', userSchema);
