import UserModel from '../models/user.js';
import { ApolloError, AuthenticationError } from 'apollo-server-core';
import type { TokensPair } from '@hawk.so/types';
import { verifyRefreshToken } from '../lib/auth-tokens.js';
import type { ResolverContextBase } from '../types/graphql.js';

type EmptyParent = Record<string, never>;

const Mutation = {
  user: () => ({}),
};

const UserMutations = {
  signUp: async (_root: EmptyParent, { email }: {email: string}) => {
    await UserModel.createByEmail(email);

    return true;
  },

  login: async (_root: EmptyParent, { email, password }: {email: string, password: string}) => {
    const user = await UserModel.findByEmail(email);

    if (!user || !(await user.comparePassword(password))) {
      throw new AuthenticationError('Wrong email or password');
    }

    return user.generateTokensPair();
  },

  refreshTokens: async (
    _obj: undefined,
    { refreshToken }: {refreshToken: string}
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
    _obj: undefined,
    { email }: {email: string}
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
    _obj: undefined,
    { oldPassword, newPassword }: { oldPassword: string; newPassword: string },
    { user }: ResolverContextBase
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

export default {
  Mutation,
  UserMutations,
};
