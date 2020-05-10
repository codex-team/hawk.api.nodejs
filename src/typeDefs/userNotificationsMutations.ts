import { gql } from 'apollo-server-express';

export default gql`
  """
  The structure represents payload for toggling receive type
  """
  input ChangeUserNotificationsReceiveTypeInput {
    IssueAssigning: Boolean
    WeeklyDigest: Boolean
  }

  """
  This object will be returned to the changeUserNotificationsChannel mutation
  """
  type changeUserNotificationsChannelResponse {
    notifications: UserNotificationsSettings
  }

  """
  This object will be returned to the changeUserNotificationsReceiveType mutation
  """
  type changeUserNotificationsReceiveTypeResponse {
    notifications: UserNotificationsSettings
  }

  extend type Mutation {
    """
    Change user notifications channel settings
    """
    changeUserNotificationsChannel(
      """
      Channel data to update
      """
      input: NotificationsChannelsInput!
    ): changeUserNotificationsChannelResponse! @requireAuth

    """
    Toggle user notifications receive type active status
    """
    changeUserNotificationsReceiveType(
      """
      Receive type with its new is-enabled value
      """
      input: ChangeUserNotificationsReceiveTypeInput!
    ): changeUserNotificationsReceiveTypeResponse! @requireAuth
  }
`;
