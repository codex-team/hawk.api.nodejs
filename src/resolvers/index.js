const User = require('../models/user');

const { GraphQLString } = require('graphql');
const { AuthenticationError } = require('apollo-server-express/dist/index');

module.exports = {
  Token: {
    GraphQLString,
    name: 'Token'
  },
  Query: {
    health: () => 'ok',

    async me(_, __, { user }) {
      if (!user.userId) {
        return null;
      }

      return User.findById(user.userId);
    }
  },
  Mutation: {
    async signUp(_, { email }) {
      const user = await User.create(email);

      console.log(`New user: email: ${user.email}, password: ${user.generatedPassword}`);

      return user.generateJWT();
    },

    async login(_, { email, password }) {
      const user = await User.findOne({ email });

      if (!user || !await user.comparePassword(password)) {
        throw new AuthenticationError('Wrong email or password');
      }

      return user.generateJWT();
    }
  }
};
