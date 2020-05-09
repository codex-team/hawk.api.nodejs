import { gql } from 'apollo-server-express';

export default gql`
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
