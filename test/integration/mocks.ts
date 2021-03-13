import { UserDBScheme, UserNotificationType } from 'hawk.types';
import { ObjectId } from 'mongodb';

export const user: UserDBScheme = {
  _id: new ObjectId(),
  notifications: {
    whatToReceive: {
      [UserNotificationType.IssueAssigning]: true,
      [UserNotificationType.SystemMessages]: true,
      [UserNotificationType.WeeklyDigest]: true,
    },
    channels: {
      email: {
        isEnabled: true,
        endpoint: 'test@hawk.so',
        minPeriod: 10,
      },
    },
  },
};
