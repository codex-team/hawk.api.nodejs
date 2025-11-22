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

    """
    Loop channel
    """
    loop: NotificationsChannelSettingsInput

    """
    Web push
    """
    webPush: NotificationsChannelSettingsInput

    """
    Desktop push
    """
    desktopPush: NotificationsChannelSettingsInput
  }
`;
