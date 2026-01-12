import { ResolverContextBase, ResolverContextWithUser, UserJWTData } from '../types/graphql';
import UserModel, { TokensPair } from '../models/user';
import { AuthenticationError, ApolloError, UserInputError } from 'apollo-server-express';
import jwt, { Secret } from 'jsonwebtoken';
import { errorCodes } from '../errors';
import Validator from '../utils/validator';
import { SenderWorkerTaskType } from '../types/userNotifications';
import { TaskPriorities, emailNotification } from '../utils/emailNotifications';
import isE2E from '../utils/isE2E';
import { dateFromObjectId } from '../utils/dates';
import { UserDBScheme } from '@hawk.so/types';
import * as telegram from '../utils/telegram';
import { MongoError } from 'mongodb';
import { validateUtmParams } from '../utils/utm/utm';

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
    async me(
      _obj: undefined,
      _args: {},
      { user, factories }: ResolverContextWithUser
    ): Promise<UserModel | null> {
      return factories.usersFactory.findById(user.id);
    },
  },
  Mutation: {
    /**
     * Register user with provided email
     * @param _obj - parent object (undefined for this resolver)
     * @param email - user email
     * @param utm - Data form where user went to sign up. Used for analytics purposes
     * @param factories - factories for working with models
     */
    async signUp(
      _obj: undefined,
      { email, utm }: { email: string; utm?: UserDBScheme['utm'] },
      { factories }: ResolverContextBase
    ): Promise<boolean | string> {
      const validatedUtm = validateUtmParams(utm);

      let user;

      try {
        user = await factories.usersFactory.create(email, undefined, validatedUtm);

        const password = user.generatedPassword!;

        await emailNotification({
          type: SenderWorkerTaskType.SignUp,
          payload: {
            password: password,
            endpoint: email,
          },
        }, {
          priority: TaskPriorities.IMPORTANT,
        });

        const source = user.utm?.source;

        telegram.sendMessage(`🚶 User "${email}" signed up` + (source ? `, from ${source}` : ''));

        return isE2E ? password : true;
      } catch (e) {
        if ((e as MongoError).code?.toString() === errorCodes.DB_DUPLICATE_KEY_ERROR) {
          throw new AuthenticationError(
            'User with this email already registered'
          );
        }
        throw e;
      }
    },

    /**
     * Login user with provided email and password
     * @param _obj - parent object (undefined for this resolver)
     * @param email - user email
     * @param password - user password
     * @param factories - factories for working with models
     */
    async login(
      _obj: undefined,
      { email, password }: {email: string; password: string},
      { factories }: ResolverContextBase
    ): Promise<TokensPair> {
      const user = await factories.usersFactory.findByEmail(email);

      if (!user || !(await user.comparePassword(password))) {
        throw new AuthenticationError('Wrong email or password');
      }

      /**
       * Check if there is a workspace with enforced SSO
       * If user is a member of any workspace with enforced SSO, they must use SSO login
       */
      const workspacesIds = await user.getWorkspacesIds([]);
      const workspaces = await factories.workspacesFactory.findManyByIds(workspacesIds);

      const enforcedWorkspace = workspaces.find(w => w.sso?.enabled && w.sso?.enforced);

      if (enforcedWorkspace) {
        throw new AuthenticationError(
          'This workspace requires SSO login. Please use SSO to sign in.'
        );
      }

      return user.generateTokensPair();
    },

    /**
     * Update user's tokens pair
     * @param _obj - parent object (undefined for this resolver)
     * @param refreshToken - refresh token for getting new token pair
     * @param factories - factories for working with models
     */
    async refreshTokens(
      _obj: undefined,
      { refreshToken }: {refreshToken: string},
      { factories }: ResolverContextBase
    ): Promise<TokensPair> {
      let userId;

      try {
        const data = await jwt.verify(refreshToken, process.env.JWT_SECRET_REFRESH_TOKEN as Secret) as UserJWTData;

        userId = data.userId;
      } catch (err) {
        throw new AuthenticationError('Invalid refresh token');
      }

      const user = await factories.usersFactory.findById(userId);

      if (!user) {
        throw new ApolloError('There is no users with that id');
      }

      return user.generateTokensPair();
    },

    /**
     * Reset user password
     * @param _obj - parent object (undefined for this resolver)
     * @param email - user email
     * @param factories - factories for working with models
     */
    async resetPassword(
      _obj: undefined,
      { email }: {email: string},
      { factories }: ResolverContextBase
    ): Promise<boolean> {
      /**
       * @todo Better password reset via one-time link
       */
      const user = await factories.usersFactory.findByEmail(email);

      if (!user) {
        return true;
      }

      try {
        const newPassword = await UserModel.generatePassword();

        await user.changePassword(newPassword);

        await emailNotification({
          type: SenderWorkerTaskType.PasswordReset,
          payload: {
            newPassword: newPassword,
            endpoint: email,
          },
        }, {
          priority: TaskPriorities.IMPORTANT,
        });
      } catch (err) {
        throw new ApolloError('Something went wrong');
      }

      return true;
    },

    /**
     * Update profile user data
     * @param _obj - parent object (undefined for this resolver)
     * @param name - user's name to change
     * @param email - user's email to change
     * @param user - current authenticated user
     * @param image - user avatar
     * @param factories - factories for working with models
     */
    async updateProfile(
      _obj: undefined,
      { name, email, image }: {name: string; email: string; image: string},
      { user, factories }: ResolverContextWithUser
    ): Promise<boolean> {
      if (email && !Validator.validateEmail(email)) {
        throw new UserInputError('Wrong email format');
      }

      const userWithEmail = await factories.usersFactory.findByEmail(email);
      const currentUser = await factories.usersFactory.findById(user.id);

      // TODO: replace with email verification
      if (userWithEmail && userWithEmail._id.toString() !== user.id) {
        throw new UserInputError('This email is taken');
      }

      try {
        const options: {[key: string]: string | object} = {
          name,
          email,
          'notifications.channels.email.endpoint': email,
        };

        if (image) {
          options.image = image;
        }

        await currentUser!.updateProfile(options);
      } catch (err) {
        throw new ApolloError((err as Error).toString());
      }

      return true;
    },

    /**
     * Change user password
     * @param _obj - parent object (undefined for this resolver)
     * @param oldPassword - old password
     * @param newPassword - password to change
     * @param user - current authenticated user
     * @param factories - factories for working with models
     */
    async changePassword(
      _obj: undefined,
      { oldPassword, newPassword }: { oldPassword: string; newPassword: string },
      { user, factories }: ResolverContextWithUser
    ): Promise<boolean> {
      const foundUser = await factories.usersFactory.findById(user.id);

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
  },
  User: {
    /**
     * Returns user registration date
     *
     * @param {UserDBScheme} user - result of parent resolver
     *
     * @returns {Date}
     */
    registrationDate(user: UserDBScheme): Date {
      return dateFromObjectId(user._id);
    },
  },
};
