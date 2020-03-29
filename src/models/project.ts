import { ObjectId } from 'mongodb';

/**
 * Structure represents a Project in DataBase
 */
export interface ProjectDBScheme {
  /**
   * Project ID
   */
  _id: ObjectId;

  /**
   * Project Integration Token
   */
  token: string;

  /**
   * Project name
   */
  name: string;

  /**
   * User who created project
   */
  uidAdded: ObjectId;

  /**
   * Project description
   */
  description?: string;

  /**
   * URL of a project logo
   */
  image?: string;

  /**
   * Project notifications settings
   */
  notifications?: ProjectNotificationsRuleDBScheme[];
}

/**
 * This structure represents a single rule of notifications settings
 */
export interface ProjectNotificationsRuleDBScheme {
  /**
   * Id of Rule
   */
  _id: ObjectId;

  /**
   * Allows to disable rule without removing
   */
  isEnabled: true;

  /**
   * Creator of the rule
   */
  uidAdded: string;

  /**
   * Receive type: 'ALL'  or 'ONLY_NEW'
   */
  whatToReceive: ReceiveTypes;

  /**
   * Only those which contains passed words
   */
  including: string[];

  /**
   * Skip those which contains passed words
   */
  excluding: string[];

  /**
   * Available channels to receive
   */
  channels: NotificationsChannelsDBScheme;
}

/**
 * Available options of 'What to receive'
 */
export enum ReceiveTypes {
  /**
   * All notifications
   */
  ALL = 'ALL',

  /**
   * Only first occurrence
   */
  ONLY_NEW = 'ONLY_NEW',
}

/**
 * Available channels ("where to receive")
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
   * Alerts through the Telegram
   */
  telegram?: NotificationsChannelSettingsDBScheme;
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
   * Endpoint: email, slack webhook, telegram bot webhook
   */
  endpoint: string;

  /**
   * Minimal pause between second notification, in seconds
   */
  minPeriod?: number;
}
