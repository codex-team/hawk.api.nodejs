import { gql } from 'apollo-server-express';

export default gql`
  """
  Input type for updateting channel settings
  """
  input NotificationsChannelSettingsInput {
    """
    True if channel is enabled
    """
    isEnabled: Boolean!

    """
    Where to deliver messages
    """
    endpoint: String!

    """
    How often to send event
    """
    minPeriod: Int!
  }

  """
  Input type for creating and updating notification channels
  """
  input NotificationsChannelsInput {
    """
    Email channel
    """
    email: NotificationsChannelSettingsInput

    """
    Telegram channel
    """
    telegram: NotificationsChannelSettingsInput

    """
    Slack channel
    """
    slack: NotificationsChannelSettingsInput
  }

  """
  Input type for creating new notification rule
  """
  input CreateProjectNotificationsRuleInput {
    """
    Project id to setup
    """
    projectId: ID!

    """
    True if settings is enabled
    """
    isEnabled: Boolean!

    """
    What events type to recieve
    """
    whatToRecieve: ReceiveTypes!

    """
    Words to include in notification
    """
    including: [String!]!

    """
    Words to exclude from notification
    """
    excluding: [String!]!

    """
    Notification channels to recieve events
    """
    channels: NotificationsChannelsInput
  }

  extend type Mutation {
    """
    Creates new notification rule for project common settings
    """
    createProjectNotificationsRule(
      "Data for creating"
      input: CreateProjectNotificationsRuleInput
    ): ProjectNotificationsRule @requireAuth
  }
`;
