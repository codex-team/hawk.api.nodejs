import { gql } from 'apollo-server-express';

export default gql`
  """
  This object stored in user.notifications field
  """
  type UserNotificationsSettings {
    """
    Available notify types with their active statuses
    """
    whatToReceive: UserNotificationsReceiveTypesSet!

    """
    Available channels with their data
    """
    channels: NotificationsChannels!
  }

  """
  Available notify types with their active statuses
  """
  type UserNotificationsReceiveTypesSet {
    """
    When user is assigned to the issue (event)
    """
    IssueAssigning: Boolean

    """
    Regular digest of what happened on the project for the week
    """
    WeeklyDigest: Boolean

    """
    Only important messages from Hawk team
    """
    SystemMessages: Boolean
  }

  enum UserNotificationType {
    """
    When user is assigned to the issue (event)
    """
    IssueAssigning

    """
    Regular digest of what happened on the project for the week
    """
    WeeklyDigest

    """
    Only important messages from Hawk team
    """
    SystemMessages
  }
`;
