import { Collection, ObjectId } from 'mongodb';
import AbstractModel from './abstractModel';
import { NotificationsChannelsDBScheme } from '../types/notification-channels';
import { ProjectDBScheme } from 'hawk.types';
import uuid from "uuid";

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
  isEnabled: boolean;

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
 * Payload for creating new notification rule
 */
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
 * Payload for updating existing notifications rule
 */
interface UpdateProjectNotificationsRulePayload {
  /**
   * Rule id to update
   */
  ruleId: string;

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
   * Integration id that's used in collector URL
   */
  public integrationId!: string;

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
   * Workspace id which project is belong
   */
  public workspaceId!: ObjectId;

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
   * Generates new integration token with integration id field
   *
   * @param integrationId - integration id for using in collector URL
   */
  public static generateIntegrationToken(integrationId: string): string {
    const secret = uuid.v4();

    const decodedIntegrationToken = {
      integrationId,
      secret,
    };

    return Buffer
      .from(JSON.stringify(decodedIntegrationToken))
      .toString('base64');
  }

  /**
   * Creates new notification rule and add it to start of the array of notifications rules
   * @param payload - rule data to save
   */
  public async createNotificationsRule(payload: CreateProjectNotificationsRulePayload): Promise<ProjectNotificationsRuleDBScheme> {
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
        notifications: {
          $each: [ rule ],
          $position: 0,
        },
      },
    });

    return rule;
  }

  /**
   * Updates notifications rule in project
   * @param payload - data for updating
   */
  public async updateNotificationsRule(payload: UpdateProjectNotificationsRulePayload): Promise<ProjectNotificationsRuleDBScheme | null> {
    const rule: Partial<ProjectNotificationsRuleDBScheme> = {
      _id: new ObjectId(payload.ruleId),
      isEnabled: payload.isEnabled,
      whatToReceive: payload.whatToReceive,
      channels: payload.channels,
      including: payload.including,
      excluding: payload.excluding,
    };

    const result = await this.collection.findOneAndUpdate(
      {
        _id: this._id,
        notifications: {
          $elemMatch: {
            _id: new ObjectId(payload.ruleId),
          },
        },
      },
      {
        $set: {
          'notifications.$': rule,
        },
      },
      {
        returnOriginal: false,
      }
    );

    return result.value?.notifications.find(doc => doc._id.toString() === payload.ruleId) || null;
  }

  /**
   * Removes notifications rule
   * @param ruleId - rule id to delete
   */
  public async deleteNotificationsRule(ruleId: string): Promise<ProjectNotificationsRuleDBScheme | null> {
    const result = await this.collection.findOneAndUpdate(
      {
        _id: this._id,
      },
      {
        $pull: {
          notifications: {
            _id: new ObjectId(ruleId),
          },
        },
      },
      {
        returnOriginal: false,
      });

    return result.value?.notifications.find(doc => doc._id.toString() === ruleId) || null;
  }

  /**
   * Toggles enabled state of the notifications rule
   * @param ruleId - rule id to update
   */
  public async toggleNotificationsRuleEnabledState(ruleId: string): Promise<ProjectNotificationsRuleDBScheme | null> {
    const rule = this.notifications.find(_rule => _rule._id.toString() === ruleId);

    if (!rule) {
      return null;
    }

    rule.isEnabled = !rule.isEnabled;

    const result = await this.collection.findOneAndUpdate(
      {
        _id: this._id,
        notifications: {
          $elemMatch: {
            _id: new ObjectId(ruleId),
          },
        },
      },
      {
        $set: {
          'notifications.$': rule,
        },
      },
      {
        returnOriginal: false,
      }
    );

    return result.value?.notifications.find(doc => doc._id.toString() === ruleId) || null;
  }

  /**
   * Updates project data in DataBase
   * @param projectData - projectData to save
   */
  public async updateProject(projectData: ProjectDBScheme): Promise<ProjectDBScheme> {
    let result;

    try {
      result = await this.collection.findOneAndUpdate(
        { _id: new ObjectId(this._id) },
        {
          $set: projectData,
        },
        { returnOriginal: false }
      );
    } catch (e) {
      throw new Error('Can\'t update project');
    }
    if (!result.value) {
      throw new Error('There is no project with provided id');
    }

    return result.value;
  }

  /**
   * Remove project data
   */
  public async remove(): Promise<void> {
    await this.collection.deleteOne({ _id: this._id });

    try {
      /**
       * Remove users in project collection
       */
      await this.dbConnection.collection('users-in-project:' + this._id)
        .drop();
    } catch (error) {
      console.log(`Can't remove collection "users-in-project:${this._id}" because it doesn't exist.`);
      console.log(error);
    }
  }
}
