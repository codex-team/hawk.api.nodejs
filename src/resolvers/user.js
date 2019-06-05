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
     * @param {ResolverObj} _obj
     * @param {ResolverArgs} _args
     * @param {Context}
     * @return {Promise<User>}
     */
    async me(_obj, _args, { user }) {
      return User.findById(user.id);
    }
  },
  Mutation: {
    /**
     * Register user with provided email
     * @param {ResolverObj} _obj
     * @param {String} email - user email
     * @return {Promise<Token>}
     */
    async signUp(_obj, { email }) {
      const user = await User.create(email);

      console.log(`New user: email: ${user.email}, password: ${user.generatedPassword}`);

      return user.generateJWT();
    },

    /**
     * Login user with provided email and password
     * @param {ResolverObj} _obj
     * @param {String} email - user email
     * @param {String} password - user password
     * @return {Promise<Token>}
     */
    async login(_obj, { email, password }) {
      const user = await User.findOne({ email });

      if (!user || !await user.comparePassword(password)) {
        throw new AuthenticationError('Wrong email or password');
      }

      return user.generateJWT();
    }
  }
};
