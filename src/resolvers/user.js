const { GraphQLString } = require('graphql');
const { AuthenticationError } = require('apollo-server-express');
const User = require('../models/user');

/**
 * See all types and fields here {@see ../typeDefs/user.graphql}
 */
module.exports = {
  /**
   * @see Token
   */
  Token: {
    GraphQLString,
    name: 'Token'
  },
  Query: {
    /**
     * Returns authenticated user data
     * @param {ResolverObj} _
     * @param {ResolverArgs} __
     * @param {Context}
     * @return {Promise<User>}
     */
    async me(_, __, { user }) {
      if (user && !user.id) {
        return null;
      }

      return User.findById(user.id);
    }
  },
  Mutation: {
    /**
     * Register user with provided email
     * @param {ResolverObj} _
     * @param {String} email - user email
     * @return {Promise<Token>}
     */
    async signUp(_, { email }) {
      const user = await User.create(email);

      console.log(`New user: email: ${user.email}, password: ${user.generatedPassword}`);

      return user.generateJWT();
    },

    /**
     * Login user with provided email and password
     * @param {ResolverObj} _
     * @param {String} email - user email
     * @param {String} password - user password
     * @return {Promise<Token>}
     */
    async login(_, { email, password }) {
      const user = await User.findOne({ email });

      if (!user || !await user.comparePassword(password)) {
        throw new AuthenticationError('Wrong email or password');
      }

      return user.generateJWT();
    }
  }
};
