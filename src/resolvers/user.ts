import {ResolverContextBase, UserJWTData} from "../types/graphql";
import UserModel from "../models/user";
import { AuthenticationError, ApolloError, UserInputError } from 'apollo-server-express';
import jwt from 'jsonwebtoken';
import { errorCodes } from '../errors';
import emailProvider from'../email';
import {names as emailTemplatesNames} from '../email/templates';
import Validator from '../utils/validator';

/**
 * See all types and fields here {@see ../typeDefs/user.graphql}
 */
export default {
  Query: {
    /**
     * Returns authenticated user data
     * @param _obj - parent object (undefined for this resolver)
     * @param _args - query args (empty)
     * @param user - current authenticated user
     * @param factories - factories for working with models
     */
    async me(_obj: undefined, _args: {}, { user, factories }: ResolverContextBase) {
      if (!user.id){
        throw new ApolloError('kek')
      }
      return factories.usersFactory.findById(user.id);
    }
  },
  Mutation: {
    /**
     * Register user with provided email
     * @param _obj
     * @param email - user email
     * @param factories - factories for working with models
     */
    async signUp(_obj: undefined, { email }: {email: string}, {factories}: ResolverContextBase) {
      let user;

      try {
        user = await factories.usersFactory.create(email);
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
     * @param factories
     */
    async login(_obj: undefined, { email, password }: {email: string, password: string}, {factories}: ResolverContextBase) {
      const user = await factories.usersFactory.findByEmail(email);

      if (!user || !(await user.comparePassword(password))) {
        throw new AuthenticationError('Wrong email or password');
      }

      return user.generateTokensPair();
    },

    /**
     * Update user's tokens pair
     * @param  _obj
     * @param refreshToken - refresh token for getting new token pair
     * @return {Promise<TokensPair>}
     */
    async refreshTokens(_obj: undefined, { refreshToken }: {refreshToken: string}, {factories}: ResolverContextBase) {
      let userId;

      try {
        const data = await jwt.verify(refreshToken, process.env.JWT_SECRET) as UserJWTData;

        userId = data.userId;
      } catch (err) {
        throw new AuthenticationError('Invalid refresh token');
      }

      const user = await factories.usersFactory.findById(userId);

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
    async resetPassword(_obj: undefined, { email }: {email: string}, {factories}: ResolverContextBase) {
      /**
       * @todo Better password reset via one-time link
       */
      const user = await factories.usersFactory.findByEmail(email);

      if (!user) {
        return true;
      }

      try {
        const newPassword = await UserModel.generatePassword();

        await UserModel.changePassword(user._id, newPassword);

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
     * @param factories
     * @return {Promise<Boolean>}
     */
    async updateProfile(_obj: undefined, { name, email }: {name: string, email: string}, { user, factories }: ResolverContextBase) {
      if (email && !Validator.validateEmail(email)) {
        throw new UserInputError('Wrong email format');
      }

      const userWithEmail = await factories.usersFactory.findByEmail(email);

      // TODO: replace with email verification
      if (userWithEmail && userWithEmail._id.toString() !== user.id) {
        throw new UserInputError('This email is taken');
      }

      try {
        await UserModel.updateProfile(user.id!, { name, email });
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
     * @param factories
     * @return {Promise<Boolean>}
     */
    async changePassword(_obj: undefined, { oldPassword, newPassword }: { oldPassword: string, newPassword:string }, { user , factories}: ResolverContextBase) {
      const foundUser = await factories.usersFactory.findById(user.id!);

      if (!foundUser) {
        throw new ApolloError('kekek')
      }

      if (!user || !(await foundUser.comparePassword(oldPassword))) {
        throw new AuthenticationError('Wrong old password. Try again.');
      }

      try {
        await UserModel.changePassword(user.id!, newPassword);
      } catch (err) {
        throw new ApolloError('Something went wrong');
      }

      return true;
    }
  }
};
