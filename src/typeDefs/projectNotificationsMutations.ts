import { gql } from 'apollo-server-express';

export default gql`
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

    """
    Threshold to receive notification
    """
    threshold: Int

    """
    Period to receive notification
    """
    thresholdPeriod: ThresholdPeriod
  }

  """
  Input type for updating exsiting notification rule
  """
  input UpdateProjectNotificationsRuleInput {
    """
    Rule id to update
    """
    ruleId: ID!

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

    """
    Threshold to receive notification
    """
    threshold: Int

    """
    Period to receive notification
    """
    thresholdPeriod: ThresholdPeriod
  }

  """
  Input type for specifying project notifications rule
  """
  input ProjectNotificationRulePointer {
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
    Creates new notification rule and add it to start of the array of notifications rules
    """
    createProjectNotificationsRule(
      "Data for creating"
      input: CreateProjectNotificationsRuleInput!
    ): ProjectNotificationsRule @requireAdmin

    """
    Updates existing notifications rule
    """
    updateProjectNotificationsRule(
      "Data for updating"
      input: UpdateProjectNotificationsRuleInput!
    ): ProjectNotificationsRule @requireAdmin

    """
    Removes notifications rule from project
    """
    deleteProjectNotificationsRule(
      "Data for deleting"
      input: ProjectNotificationRulePointer!
    ): ProjectNotificationsRule @requireAdmin

    """
    Toggles isEnabled field in in project notifications rule
    """
    toggleProjectNotificationsRuleEnabledState(
      "Data for toggling"
      input: ProjectNotificationRulePointer
    ): ProjectNotificationsRule @requireAdmin
  }
`;
