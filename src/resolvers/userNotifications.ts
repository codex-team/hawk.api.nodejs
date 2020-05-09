import { ResolverContextWithUser } from '../types/graphql';
import { ApolloError, UserInputError } from 'apollo-server-express';
import { UserNotificationType } from '../models/user';
import { NotificationsChannelsDBScheme } from '../types/notification-channels';

/**
 * We will get this structure from the client to update Channel settings
 */
interface ChangeUserNotificationsChannelPayload {
  /**
   * Channels with their settings
   */
  input: NotificationsChannelsDBScheme;
}

/**
 * We will get this structure from the client to toggle Receive type
 */
interface ChangeUserNotificationsReceiveTypePayload {
  /**
   * Types of notifications to receive
   */
  input: {[key in UserNotificationType]: boolean};
}

export default {
  Mutation: {
    /**
     * Change settings of passed channel of the user notification
     *
     * @param _obj - parent object
     * @param user - current authorized user {@see ../index.js}
     * @param factories - factories for working with models
     * @param input - payload with channel data
     */
    async changeUserNotificationsChannel(
      _obj: undefined,
      { input }: ChangeUserNotificationsChannelPayload,
      { user, factories }: ResolverContextWithUser
    ): Promise<boolean> {
      console.log('changeUserNotificationsChannel input >>', input);

      return true;
    },

    /**
     * Toggle receive type of user notifications
     *
     * @param _obj - parent object
     * @param user - current authorized user {@see ../index.js}
     * @param factories - factories for working with models
     * @param input - payload with receive type and it's active status
     */
    async changeUserNotificationsReceiveType(
      _obj: undefined,
      { input }: ChangeUserNotificationsReceiveTypePayload,
      { user, factories }: ResolverContextWithUser
    ): Promise<boolean> {
      console.log('changeUserNotificationsReceiveType input >>', input);

      return true;
    },
  },
};
