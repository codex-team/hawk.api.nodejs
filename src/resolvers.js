const { MongoError } = require('mongodb');
const argon2 = require('argon2');
const { sign } = require('jsonwebtoken');
const { User } = require('./models/user');

module.exports = {
  Query: {
    health: () => 'ok',
    me: async (_, __, { req }) => {
      if (!req.userId) {
        return null;
      }

      try {
        return User.findById(req.userId);
      } catch (err) {
        if (err instanceof MongoError) {
          return null;
        } else {
          throw err;
        }
      }
    }
  },
  Mutation: {
    register: async (_, { email, password }) => {
      const hashedPassword = await argon2.hash(password);

      try {
        await User.create({
          email,
          password: hashedPassword
        });
      } catch (err) {
        if (err instanceof MongoError) {
          return false;
        } else {
          throw err;
        }
      }

      return true;
    },
    login: async (_, { email, password }) => {
      const user = await User.findOne({ email });

      if (!user) {
        return null;
      }

      const valid = await argon2.verify(user.password, password);

      if (!valid) {
        return null;
      }

      return sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: '1d'
      });
    }
  }
};
