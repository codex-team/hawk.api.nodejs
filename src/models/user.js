const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
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

const User = mongoose.model('User', UserSchema);

module.exports = {
  User
};
