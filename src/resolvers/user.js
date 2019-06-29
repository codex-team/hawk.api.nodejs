const { AuthenticationError, ApolloError } = require('apollo-server-express');
const User = require('../models/user');
const jwt = require('jsonwebtoken');
const { errorCodes } = require('../errors');
const emailProvider = require('../email');
const { names: emailTemplatesNames } = require('../email/templates');

/**
 * See all types and fields here {@see ../typeDefs/user.graphql}
 */
module.exports = {
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
     * @return {Promise<TokensPair>}
     */
    async signUp(_obj, { email }) {
      let user;

      try {
        user = await User.create(email);
        emailProvider.send(email, emailTemplatesNames.SUCCESSFUL_SIGN_UP,
          {
            email,
            password: user.generatedPassword
          });
      } catch (e) {
        if (e.code.toString() === errorCodes.DB_DUPLICATE_KEY_ERROR) {
          throw new AuthenticationError('User with such email already registered');
        }
        throw e;
      }

      return user.generateTokensPair();
    },

    /**
     * Login user with provided email and password
     * @param {ResolverObj} _obj
     * @param {String} email - user email
     * @param {String} password - user password
     * @return {Promise<TokensPair>}
     */
    async login(_obj, { email, password }) {
      const user = await User.findOne({ email });

      if (!user || !await user.comparePassword(password)) {
        throw new AuthenticationError('Wrong email or password');
      }

      return user.generateTokensPair();
    },

    /**
     * Update user's tokens pair
     * @param {ResolverObj} _obj
     * @param {String} refreshToken - refresh token for getting new token pair
     * @return {Promise<TokensPair>}
     */
    async refreshTokens(_obj, { refreshToken }) {
      let userId;

      try {
        const data = await jwt.verify(refreshToken, process.env.JWT_SECRET);

        userId = data.userId;
      } catch (err) {
        throw new AuthenticationError('Invalid refresh token');
      }

      const user = await User.findById(userId);

      if (!user) throw new ApolloError('There is no users with that id');
      return user.generateTokensPair();
    }
  }
};
