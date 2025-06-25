import { Collection, ObjectId } from 'mongodb';
import AbstractModel from './abstractModel';
import { NotificationsChannelsDBScheme } from '../types/notification-channels';
import { ProjectDBScheme, ProjectNotificationsRuleDBScheme, ProjectEventGroupingPatternsDBScheme } from '@hawk.so/types';
import { v4 as uuid } from 'uuid';

/**
 * Available options of 'What to receive'
 */
export enum ReceiveTypes {
  /**
   * Notify if more than n error occurrences in the given period
   */
  SEEN_MORE = 'SEEN_MORE',

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
   * Receive type: 'SEEN_MORE'  or 'ONLY_NEW'
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

  /**
   * If this number of events is reached in the eventThresholdPeriod, the rule will be triggered
   */
  threshold?: number;

  /**
   * Size of period (in milliseconds) to count events to compare to rule threshold
   */
  thresholdPeriod?: number;
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

  /**
   * If this number of events is reached in the eventThresholdPeriod, the rule will be triggered
   */
  threshold?: number;

  /**
   * Size of period (in milliseconds) to count events to compare to rule threshold
   */
  thresholdPeriod?: number;
}

/**
 * Payload for creating new project pattern
 */
type CreateProjectPatternPayload = {
  pattern: string;
};

/**
 * Payload for updating project patterns
 * It will just rewrite the whole lits of patterns
 */
type UpdateProjectPatternPayload = {
  /**
   * Id of the pattern to be updated
   */
  id: string;

  /**
   * New pattern string
   */
  pattern: string;
};

type RemoveProjectPatternPayload = {
  /**
   * Id of the pattern to be removed
   */
  id: string;
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
   * Project events grouping pattern list
   */
  public eventGroupingPatterns!: ProjectEventGroupingPatternsDBScheme[];

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
   * Generates integration ID that's used in collector URL for sending events
   */
  public static generateIntegrationId(): string {
    return uuid();
  }

  /**
   * Generates new integration token with integration id field
   *
   * @param integrationId - integration id for using in collector URL
   */
  public static generateIntegrationToken(integrationId: string): string {
    const secret = uuid();

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
   * @param isAutoAdded - true when rule is created automatically (on project creation or conversion of old projects)
   */
  public async createNotificationsRule(payload: CreateProjectNotificationsRulePayload, isAutoAdded: boolean = false): Promise<ProjectNotificationsRuleDBScheme> {
    const rule: ProjectNotificationsRuleDBScheme = {
      _id: new ObjectId(),
      uidAdded: new ObjectId(payload.uidAdded),
      isEnabled: payload.isEnabled,
      whatToReceive: payload.whatToReceive,
      channels: payload.channels,
      including: payload.including,
      excluding: payload.excluding,
    };
    
    if(isAutoAdded) {
      rule.autoAdded = '$$NOW';
    }

    if (rule.whatToReceive === ReceiveTypes.SEEN_MORE) {
      rule.threshold = payload.threshold;
      rule.thresholdPeriod = payload.thresholdPeriod;
    }

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
   * Method for appending patterns list with new pattern
   * @param payload - object that contains pattern string
   * @returns - pattern, that has been added
   */
  public async createProjectEventGroupingPattern(payload: CreateProjectPatternPayload): Promise<ProjectEventGroupingPatternsDBScheme> {
    const pattern: ProjectEventGroupingPatternsDBScheme = {
      _id: new ObjectId(),
      pattern: payload.pattern,
    };

    await this.collection.updateOne({
      _id: this._id,
    },
    {
      $push: {
        eventGroupingPatterns: {
          $each: [ pattern ],
          $position: 0,
        },
      },
    });

    return pattern;
  }

  /**
   * Method that rewrites pattern by id
   * @param payload - object that contains id of the pattern to be updated and new pattern string
   * @returns - updated pattern
   */
  public async updateProjectEventGroupingPattern(payload: UpdateProjectPatternPayload): Promise<ProjectEventGroupingPatternsDBScheme> {
    const udpatedPattern = {
      _id: new ObjectId(payload.id),
      pattern: payload.pattern,
    };

    await this.collection.updateOne({
      _id: this._id,
      'eventGroupingPatterns._id': new ObjectId(udpatedPattern._id),
    },
    {
      $set: { 'eventGroupingPatterns.$.pattern': udpatedPattern.pattern },
    });

    return udpatedPattern;
  }

  /**
   * Method that removes pattern by its id
   * @param payload - object that contains id of the pattern to be removed
   */
  public async removeProjectEventGroupingPattern(payload: RemoveProjectPatternPayload): Promise<ProjectEventGroupingPatternsDBScheme> {
    const project = await this.collection.findOne({
      _id: this._id,
    });

    if (!project) {
      throw new Error('Project with such id does not exist');
    }

    const patternList = await this.collection.findOne(
      {
        _id: this._id,
        'eventGroupingPatterns._id': new ObjectId(payload.id),
      },
      { projection: { 'eventGroupingPatterns.$': 1 } }
    );

    const deletedPattern = patternList?.eventGroupingPatterns[0];

    if (deletedPattern === undefined) {
      throw new Error('Pattern with such id does not exist');
    }

    await this.collection.updateOne(
      {
        _id: new ObjectId(this._id),
      },
      {
        $pull: { eventGroupingPatterns: { _id: new ObjectId(payload.id) } },
      }
    );

    return deletedPattern;
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

    if (rule.whatToReceive === ReceiveTypes.SEEN_MORE) {
      rule.threshold = payload.threshold;
      rule.thresholdPeriod = payload.thresholdPeriod;
    }

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
