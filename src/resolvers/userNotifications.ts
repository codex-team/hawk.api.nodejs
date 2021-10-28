import { ResolverContextWithUser } from '../types/graphql';
import { UserNotificationsDBScheme, UserNotificationType } from '../models/user';
import { NotificationsChannelsDBScheme } from '../types/notification-channels';
import { UserDBScheme } from '@hawk.so/types';

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

/**
 * This response will be sent on changeUserNotificationsChannel and changeUserNotificationsReceiveType mutations
 */
interface ChangeNotificationsResponse {
  notifications: UserNotificationsDBScheme;
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
    ): Promise<ChangeNotificationsResponse> {
      const currentUser = await factories.usersFactory.findById(user.id);
      const currentNotifySet = currentUser?.notifications || {} as UserNotificationsDBScheme;
      const oldChannels = currentNotifySet.channels || {};
      const newChannels = Object.assign(oldChannels, input);
      const newNotifySet = Object.assign(currentNotifySet, {
        channels: newChannels,
      });

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await currentUser!.updateProfile({
        notifications: newNotifySet,
      } as Pick<UserDBScheme, 'notifications'>);

      return {
        notifications: newNotifySet,
      };
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
    ): Promise<ChangeNotificationsResponse> {
      const currentUser = await factories.usersFactory.findById(user.id);
      const currentNotifySet = currentUser?.notifications || {} as UserNotificationsDBScheme;
      const oldReceiveTypes = currentNotifySet.whatToReceive || {};
      const newReceiveTypes = Object.assign(oldReceiveTypes, input);
      const newNotifySet = Object.assign(currentNotifySet, {
        whatToReceive: newReceiveTypes,
      });

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await currentUser!.updateProfile({
        notifications: newNotifySet,
      } as Pick<UserDBScheme, 'notifications'>);

      return {
        notifications: newNotifySet,
      };
    },
  },
};
