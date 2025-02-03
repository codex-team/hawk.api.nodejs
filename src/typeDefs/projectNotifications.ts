import { gql } from 'apollo-server-express';

export default gql`
  """
  What events to receive
  """
  enum ReceiveTypes {
    """
    Receive only new events
    """
    ONLY_NEW

    """
    Receive all events that reached threshold in period
    """
    SEEN_MORE
  }

  """
  Project notify settings
  """
  type ProjectNotificationsRule {
    """
    Notification settings id
    """
    id: ID! @renameFrom(name: "_id")

    """
    True if settings is enabled
    """
    isEnabled: Boolean!

    """
    What events type to recieve
    """
    whatToReceive: ReceiveTypes!

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
    channels: NotificationsChannels

    """
    Threshold to receive notification
    """
    threshold: Int

    """
    Period to receive notification
    """
    thresholdPeriod: Int
  }
`;
