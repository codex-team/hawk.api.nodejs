const { GraphQLString } = require('graphql');
const { AuthenticationError } = require('apollo-server-express');
const User = require('../models/user');

/**
 * See all types and fields here {@see ../typeDefs/user.graphql}
 */
module.exports = {
  Token: {
    GraphQLString,
    name: 'Token'
  },
  Query: {
    async me(_, __, { user }) {
      if (user && !user.id) {
        return null;
      }

      return User.findById(user.id);
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
