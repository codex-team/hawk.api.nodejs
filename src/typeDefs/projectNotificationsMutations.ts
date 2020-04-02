import { gql } from 'apollo-server-express';

export default gql`
  """
  Input type for updateting channel settings
  """
  input NotificationsChannelSettingsInput {
    """
    True if channel is enabled
    """
    isEnabled: Boolean! = true

    """
    Where to deliver messages
    """
    endpoint: String!

    """
    How often to send event (one alert in 'minPeriod' secs)
    """
    minPeriod: Int! = 60
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
    isEnabled: Boolean! = true

    """
    What events type to recieve
    """
    whatToReceive: ReceiveTypes! = ONLY_NEW

    """
    Words to include in notification
    """
    including: [String!]! = []

    """
    Words to exclude from notification
    """
    excluding: [String!]! = []

    """
    Notification channels to recieve events
    """
    channels: NotificationsChannelsInput!
  }

  """
  Input type for updating exsiting notification rule
  """
  input UpdateProjectNotificationsRuleInput {
    """
    Project id to setup
    """
    projectId: ID!

    """
    Rule id to update
    """
    ruleId: ID!

    """
    True if settings is enabled
    """
    isEnabled: Boolean! = true

    """
    What events type to recieve
    """
    whatToReceive: ReceiveTypes! = ONLY_NEW

    """
    Words to include in notification
    """
    including: [String!]! = []

    """
    Words to exclude from notification
    """
    excluding: [String!]! = []

    """
    Notification channels to recieve events
    """
    channels: NotificationsChannelsInput!
  }


  """
  Input type deleting project notifications rule
  """
  input DeleteProjectNotificationsRuleInput {
    """
    Project id which owns the rule
    """
    projectId: ID!

    """
    Rule id to delete
    """
    ruleId: ID!
  }

  extend type Mutation {
    """
    Creates new notification rule for project common settings
    """
    createProjectNotificationsRule(
      "Data for creating"
      input: CreateProjectNotificationsRuleInput!
    ): ProjectNotificationsRule @requireAdmin

    """
    Updates existing notifications rule
    """
    updateProjectNotificationsRule(
      input: UpdateProjectNotificationsRuleInput!
    ): ProjectNotificationsRule @requireAdmin

    """
    Removes notifications rule from project
    """
    deleteProjectNotificationsRule(
      input: DeleteProjectNotificationsRuleInput!
    ): ProjectNotificationsRule @requireAdmin
  }
`;
