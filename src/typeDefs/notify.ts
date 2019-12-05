import { gql } from 'apollo-server-express';

export default gql`
"""
Supported provider types
"""
enum ProviderTypes {
  EMAIL
  TELEGRAM
  SLACK
}

"""
Settings for notifications provider
"""
type ProviderSettings {
  """
  Notifications enabled?
  """
  enabled: Boolean!

  """
  Provider value
  """
  value: String

  """
  Provider name
  """
  provider: ProviderTypes!
}

"""
What events to receive
"""
enum ReceiveTypes {
  """
  Receive only new events
  """
  ONLY_NEW,

  """
  Receive all events
  """
  ALL,

  """
  Receive events that includes words from list
  """
  INCLUDING,
}

"""
Project notify settings
"""
type NotifySettings {
  """
  Notify action type
  """
  receiveType: ReceiveTypes!

  """
  Words for INCLUDING action type
  """
  words: String

  """
  Notify settings
  """
  providers: [ProviderSettings!]
}

input NotifyInput {
  """
  Notify action type
  """
  receiveType: ReceiveTypes!

  """
  Words for INCLUDING action type
  """
  words: String

  """
  Notify settings
  """
  providers: [NotifyProviderSettings!]!
}

"""
Settings for notifications provider
"""
input NotifyProviderSettings {
  """
  Is provider enabled
  """
  enabled: Boolean!

  """
  Value for provider to send notifications (email or slack webhook)
  """
  value: String!

  """
  Provider type
  """
  provider: ProviderTypes!
}

extend type Mutation {
  """
  Update project personal notification settings
  """
  updatePersonalNotificationSettings(
    "Project ID"
    projectId: ID!
    "Notify"
    notifySettings: NotifyInput!
  ): NotifySettings! @requireAuth

  """
  Update project common notification settings
  """
  updateCommonNotificationSettings(
    "Project ID"
    projectId: ID!
    "Notify"
    notifySettings: NotifyInput!
  ): NotifySettings! @requireAuth
}
`;