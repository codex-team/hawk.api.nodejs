/**
 * This file contains common structures both for account notifications and project notifications
 * Interfaces represents how notification channels stored in DB records.
 */

/**
 * Available channels
 */
export interface NotificationsChannelsDBScheme {
  /**
   * Alerts on email
   */
  email?: NotificationsChannelSettingsDBScheme;

  /**
   * Alerts through the Slack
   */
  slack?: NotificationsChannelSettingsDBScheme;

  /**
   * Alerts through the Loop
   */
  loop?: NotificationsChannelSettingsDBScheme;

  /**
   * Alerts through the Telegram
   */
  telegram?: NotificationsChannelSettingsDBScheme;

  /**
   * Browser pushes
   */
  webPush?: NotificationsChannelSettingsDBScheme;

  /**
   * Pushes through the Hawk Desktop app
   */
  desktopPush?: NotificationsChannelSettingsDBScheme;

  /**
   * Alerts through a custom Webhook URL
   */
  webhook?: NotificationsChannelSettingsDBScheme;
}

/**
 * Setting of a channel
 */
export interface NotificationsChannelSettingsDBScheme {
  /**
   * Allows to disable channel without removing endpoint
   */
  isEnabled: boolean;

  /**
   * Endpoint: email, slack/loop webhook, telegram bot webhook, push subscription id, etc
   */
  endpoint: string;

  /**
   * Minimal pause between second notification, in seconds
   */
  minPeriod: number;
}
