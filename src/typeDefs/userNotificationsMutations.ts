import { gql } from 'apollo-server-express';

export default gql`
  """
  The structure represents payload for toggling receive type
  """
  input ChangeUserNotificationsReceiveTypeInput {
    IssueAssigning: Boolean
    WeeklyDigest: Boolean
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
    ): Boolean! @requireAuth

    """
    Toggle user notifications receive type active status
    """
    changeUserNotificationsReceiveType(
      """
      Receive type with its new is-enabled value
      """
      input: ChangeUserNotificationsReceiveTypeInput!
    ): Boolean! @requireAuth
  }
`;
