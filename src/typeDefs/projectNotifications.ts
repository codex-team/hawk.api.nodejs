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
  Allowed threshold periods in milliseconds
  """
  enum ThresholdPeriod {
    """
    One minute in milliseconds
    """
    MINUTE = 60000

    """
    One hour in milliseconds
    """
    HOUR = 3600000

    """
    One day in milliseconds
    """
    DAY = 86400000

    """
    One week in milliseconds
    """
    WEEK = 604800000
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
    thresholdPeriod: ThresholdPeriod
  }
`;
