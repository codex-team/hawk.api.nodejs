import { gql } from 'apollo-server-express';

/**
 * Common notifications type both for account and project notifications
 */
export default gql`

  """
  Settings for notification channels
  """
  type NotificationsChannelSettings {
    """
    True if channel is enabled
    """
    isEnabled: Boolean!

    """
    Where to deliver messages
    """
    endpoint: String!

    """
    How often to send event (one alert in 'minPeriod' secs)
    """
    minPeriod: Int!
  }

  """
  All available notification channels
  """
  type NotificationsChannels {
    """
    Email channel
    """
    email: NotificationsChannelSettings

    """
    Telegram channel
    """
    telegram: NotificationsChannelSettings

    """
    Slack channel
    """
    slack: NotificationsChannelSettings

    """
    Loop channel
    """
    loop: NotificationsChannelSettings

    """
    Webhook channel
    """
    webhook: NotificationsChannelSettings

    """
    Webpush
    """
    webPush: NotificationsChannelSettings

    """
    Push from Hawk Desktop app
    """
    desktopPush: NotificationsChannelSettings
  }
`;
