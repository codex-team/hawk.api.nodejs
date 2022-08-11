import UserModel from '../models/user.js';
import { ApolloError, AuthenticationError } from 'apollo-server-core';
import type { TokensPair } from '@hawk.so/types';
import { verifyRefreshToken } from '../lib/auth-tokens.js';
import type { MutationResolvers, QueryResolvers, UserMutationsResolvers } from '../types/schema.js';
import ensureAuthedUser from '../lib/ensure-authed-user.js';

const Mutation: MutationResolvers = {
  user: () => ({}),
};


const Query: QueryResolvers = {
  me: async (_, __, ctx) => {
    const userId = ensureAuthedUser(ctx.user);
    const user = await UserModel.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    return user.data;
  },
};

const UserMutations: UserMutationsResolvers = {
  signUp: async (_root, { email }) => {
    await UserModel.createByEmail(email);

    return true;
  },

  login: async (_root, { email, password }) => {
    const user = await UserModel.findByEmail(email);

    if (!user || !(await user.comparePassword(password))) {
      throw new AuthenticationError('Wrong email or password');
    }

    return user.generateTokensPair();
  },

  refreshTokens: async (
    _root,
    { refreshToken }
  ): Promise<TokensPair> => {
    let userId;

    try {
      const data = await verifyRefreshToken(refreshToken);

      userId = data.userId;
    } catch (err) {
      throw new AuthenticationError('Invalid refresh token');
    }

    const user = await UserModel.findById(userId);

    if (!user) {
      throw new ApolloError('There is no users with that id');
    }

    return user.generateTokensPair();
  },

  resetPassword: async (
    _root,
    { email }
  ): Promise<boolean> => {
    /**
     * @todo Better password reset via one-time link
     */
    const user = await UserModel.findByEmail(email);

    if (!user) {
      return true;
    }

    try {
      await user.changePassword();

      // @todo send task to rabbitmq to send email with password
      // await emailNotification({
      //   type: SenderWorkerTaskType.PasswordReset,
      //   payload: {
      //     newPassword: newPassword,
      //     endpoint: email,
      //   },
      // }, {
      //   priority: TaskPriorities.IMPORTANT,
      // });
    } catch (err) {
      throw new ApolloError('Something went wrong');
    }

    return true;
  },

  changePassword: async (
    _root,
    { oldPassword, newPassword },
    { user }
  ): Promise<boolean> => {
    const foundUser = await UserModel.findById(user.id as string);

    if (!foundUser) {
      throw new ApolloError('There is no user with such id');
    }

    if (!user || !(await foundUser.comparePassword(oldPassword))) {
      throw new AuthenticationError('Wrong old password. Try again.');
    }

    try {
      await foundUser.changePassword(newPassword);
    } catch (err) {
      throw new ApolloError('Something went wrong');
    }

    return true;
  },
};

const userResolvers = {
  Mutation,
  UserMutations,
  Query,
};

export default userResolvers;
