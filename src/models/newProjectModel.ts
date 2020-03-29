import { Collection, ObjectId } from 'mongodb';
import AbstractModel from './abstractModel';

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
  notifications: ProjectNotificationsRuleDBScheme[];
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
  uidAdded: ObjectId;

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
  minPeriod: number;
}

export interface CreateProjectNotificationsRulePayload {
  /**
   * Allows to disable rule without removing
   */
  isEnabled: true;

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
   * Creator of the rule
   */
  uidAdded: string;

  /**
   * Available channels to receive
   */
  channels: NotificationsChannelsDBScheme;
}

/**
 * Project model to work with project data
 */
export default class ProjectModel extends AbstractModel<ProjectDBScheme> implements ProjectDBScheme {
  /**
   * Project ID
   */
  public _id!: ObjectId;

  /**
   * Project Integration Token
   */
  public token!: string;

  /**
   * Project name
   */
  public name!: string;

  /**
   * User who created project
   */
  public uidAdded!: ObjectId;

  /**
   * Project description
   */
  public description?: string;

  /**
   * URL of a project logo
   */
  public image?: string;

  /**
   * Project notifications settings
   */
  public notifications!: ProjectNotificationsRuleDBScheme[];

  /**
   * Model's collection
   */
  protected collection: Collection<ProjectDBScheme>;

  /**
   * Creates Workspace instance
   * @param projectData - workspace's data
   */
  constructor(projectData: ProjectDBScheme) {
    super(projectData);
    this.collection = this.dbConnection.collection<ProjectDBScheme>('projects');
  }

  /**
   * Creates new notification rule
   * @param payload - rule data to save
   */
  public async createNotificationRule(payload: CreateProjectNotificationsRulePayload): Promise<ProjectNotificationsRuleDBScheme> {
    const rule: ProjectNotificationsRuleDBScheme = {
      _id: new ObjectId(),
      uidAdded: new ObjectId(payload.uidAdded),
      isEnabled: payload.isEnabled,
      whatToReceive: payload.whatToReceive,
      channels: payload.channels,
      including: payload.including,
      excluding: payload.excluding,
    };

    await this.collection.updateOne({
      _id: this._id,
    },
    {
      $push: {
        notifications: rule,
      },
    });

    return rule;
  }
}
