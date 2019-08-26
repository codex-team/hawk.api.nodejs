const { AuthenticationError, ApolloError, UserInputError } = require('apollo-server-express');
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
     * @return {Promise<boolean>}
     */
    async signUp(_obj, { email }) {
      let user;

      try {
        user = await User.create(email);
        emailProvider.send(email, emailTemplatesNames.SUCCESSFUL_SIGN_UP, {
          email,
          password: user.generatedPassword
        });
      } catch (e) {
        if (e.code.toString() === errorCodes.DB_DUPLICATE_KEY_ERROR) {
          throw new AuthenticationError(
            'User with such email already registered'
          );
        }
        throw e;
      }

      return true;
    },

    /**
     * Login user with provided email and password
     * @param {ResolverObj} _obj
     * @param {String} email - user email
     * @param {String} password - user password
     * @return {Promise<TokensPair>}
     */
    async login(_obj, { email, password }) {
      const user = await User.findByEmail(email);

      if (!user || !(await user.comparePassword(password))) {
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
    },

    /**
     * Reset user password
     *
     * @param {ResolverObj} _obj
     * @param {string} email - user email
     * @returns {Promise<Boolean>}
     */
    async resetPassword(_obj, { email }) {
      /**
       * @todo Better password reset via one-time link
       */
      const user = await User.findByEmail(email);

      if (!user) {
        return true;
      }

      try {
        const newPassword = await User.generatePassword();

        await User.changePassword(user.id, newPassword);

        /**
         * @todo Make email queue
         */
        emailProvider.send(email, emailTemplatesNames.PASSWORD_RESET, {
          email,
          password: newPassword
        });
      } catch (err) {
        throw new ApolloError('Something went wrong');
      }

      return true;
    },

    /**
     * Update profile user data
     *
     * @param {ResolverObj} _obj
     * @param {string} name
     * @param {string} email
     * @param {User} user
     * @returns {Promise<Boolean>}
     */
    async updateProfile(_obj, { name, email }, { user }) {
      const re = /\S+@\S+\.\S+/;

      if (!re.test(String(email).toLowerCase())) {
        throw new UserInputError('Wrong email format');
      }

      const userWithEmail = (await User.findByEmail(email));

      if (userWithEmail && userWithEmail.id.toString() !== user.id) {
        throw new UserInputError('This email is taken');
      }

      try {
        await User.updateProfile(user.id, name, email);
      } catch (err) {
        throw new ApolloError('Something went wrong');
      }

      return true;
    },

    /**
     * Change user password
     *
     * @param {ResolverObj} _obj
     *
     * @param {string} oldPassword
     * @param {string} newPassword
     * @param {User} user
     * @returns {Promise<Boolean>}
     */
    async changePassword(_obj, { oldPassword, newPassword }, { user }) {
      user = await User.findById(user.id);

      if (!user || !(await user.comparePassword(oldPassword))) {
        throw new AuthenticationError('Wrong old password. Try again.');
      }

      try {
        await User.changePassword(user.id, newPassword);
      } catch (err) {
        throw new ApolloError('Something went wrong');
      }

      return true;
    }
  }
};
