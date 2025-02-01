import {
  ProjectNotificationsRuleDBScheme,
  ReceiveTypes
} from '../models/project';
import { ResolverContextWithUser } from '../types/graphql';
import { ApolloError, UserInputError } from 'apollo-server-express';
import { NotificationsChannelsDBScheme, NotificationsChannelSettingsDBScheme } from '../types/notification-channels';

/**
 * Mutation payload for creating notifications rule from GraphQL Schema
 */
interface CreateProjectNotificationsRuleMutationPayload {
  /**
   * Project id to update
   */
  projectId: string;

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
   * Threshold to receive notification
   */
  threshold: number;

  /**
   * Period to receive notification
   */
  thresholdPeriod: number;
}

/**
 * Mutation payload for updating project notifications rule
 */
interface UpdateProjectNotificationsRuleMutationPayload extends CreateProjectNotificationsRuleMutationPayload {
  /**
   * Rule id to update
   */
  ruleId: string;
}

/**
 * Mutation payload for deleting project notifications rule
 */
interface ProjectNotificationsRulePointer {
  /**
   * Project id which owns the rule
   */
  projectId: string;

  /**
   * Rule id to delete
   */
  ruleId: string;
}

/**
 * Return true if all passed channels are empty
 * @param channels - project notifications channels
 */
function isChannelsEmpty(channels: NotificationsChannelsDBScheme): boolean {
  const notEmptyChannels = Object.entries(channels)
    .filter(([_, channel]) => {
      return (channel as NotificationsChannelSettingsDBScheme).endpoint.replace(/\s+/, '').trim().length !== 0;
    });

  return notEmptyChannels.length === 0;
}

/**
 * Returns true is threshold and threshold period are valid
 * @param threshold - threshold of the notification rule to be checked
 * @param thresholdPeriod - threshold period of the notification rule to be checked 
 */
function validateNotificationsRuleTresholdAndPeriod(
  threshold: ProjectNotificationsRuleDBScheme['threshold'], 
  thresholdPeriod: ProjectNotificationsRuleDBScheme['thresholdPeriod']
): string | null {
  const validThresholdPeriods = [60_000, 3_600_000, 86_400_000, 604_800_000]

  if (thresholdPeriod === undefined || !validThresholdPeriods.includes(thresholdPeriod)) {
    return'Threshold period should be one of the following: 60000, 3600000, 86400000, 604800000';
  }

  if (threshold === undefined || threshold < 1) {
    return 'Threshold should be greater than 0';
  }

  return null;
}


/**
 * Return true if all passed channels are filled with correct endpoints
 */
function validateNotificationsRuleChannels(channels: NotificationsChannelsDBScheme): string | null {
  if (channels.email!.isEnabled) {
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(channels.email!.endpoint)) {
      return 'Invalid email endpoint passed';
    }
  }

  if (channels.slack!.isEnabled) {
    if (!/^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/.test(channels.slack!.endpoint)) {
      return 'Invalid slack endpoint passed';
    }
  }

  if (channels.telegram!.isEnabled) {
    if (!/^https:\/\/notify\.bot\.codex\.so\/u\/[A-Za-z0-9]+$/.test(channels.telegram!.endpoint)) {
      return 'Invalid telegram endpoint passed';
    }
  }

  return null;
}

/**
 * See all types and fields here {@see ../typeDefs/notify.graphql}
 */
export default {
  Mutation: {
    /**
     * Creates new notification rule and add it to start of the array of notifications rules
     * @param _obj - parent object
     * @param user - current authorized user {@see ../index.js}
     * @param factories - factories for working with models
     * @param input - input data for creating
     */
    async createProjectNotificationsRule(
      _obj: undefined,
      { input }: { input: CreateProjectNotificationsRuleMutationPayload },
      { user, factories }: ResolverContextWithUser
    ): Promise<ProjectNotificationsRuleDBScheme> {
      const project = await factories.projectsFactory.findById(input.projectId);

      if (!project) {
        throw new ApolloError('No project with such id');
      }

      const channelsValidationResult = validateNotificationsRuleChannels(input.channels);

      if (channelsValidationResult !== null) {
        throw new UserInputError(channelsValidationResult);
      }

      if (input.whatToReceive === ReceiveTypes.SEEN_MORE) {
        const thresholdValidationResult = validateNotificationsRuleTresholdAndPeriod(input.threshold, input.thresholdPeriod);

        if (thresholdValidationResult !== null) {
          throw new UserInputError(thresholdValidationResult);
        }
      }
      
      return project.createNotificationsRule({
        ...input,
        uidAdded: user.id,
      });
    },

    /**
     * Updates existing notifications rule
     * @param _obj - parent object
     * @param user - current authorized user {@see ../index.js}
     * @param factories - factories for working with models
     * @param input - input data for creating
     */
    async updateProjectNotificationsRule(
      _obj: undefined,
      { input }: { input: UpdateProjectNotificationsRuleMutationPayload },
      { user, factories }: ResolverContextWithUser
    ): Promise<ProjectNotificationsRuleDBScheme | null> {
      const project = await factories.projectsFactory.findById(input.projectId);

      if (!project) {
        throw new ApolloError('No project with such id');
      }
      
      const channelsValidationResult = validateNotificationsRuleChannels(input.channels);

      if (channelsValidationResult !== null) {
        throw new UserInputError(channelsValidationResult);
      }

      if (input.whatToReceive === ReceiveTypes.SEEN_MORE) {
        const thresholdValidationResult = validateNotificationsRuleTresholdAndPeriod(input.threshold, input.thresholdPeriod);

        if (thresholdValidationResult !== null) {
          throw new UserInputError(thresholdValidationResult);
        }
      }

      return project.updateNotificationsRule(input);
    },

    /**
     * Removes notifications rule from project
     * @param _obj - parent object
     * @param user - current authorized user {@see ../index.js}
     * @param factories - factories for working with models
     * @param input - input data for deleting
     */
    async deleteProjectNotificationsRule(
      _obj: undefined,
      { input }: { input: ProjectNotificationsRulePointer },
      { user, factories }: ResolverContextWithUser
    ): Promise<ProjectNotificationsRuleDBScheme | null> {
      const project = await factories.projectsFactory.findById(input.projectId);

      if (!project) {
        throw new ApolloError('No project with such id');
      }

      return project.deleteNotificationsRule(input.ruleId);
    },

    /**
     * Toggles isEnabled field in in project notifications rule
     * @param _obj - parent object
     * @param user - current authorized user {@see ../index.js}
     * @param factories - factories for working with models
     * @param input - input data for toggling
     */
    async toggleProjectNotificationsRuleEnabledState(
      _obj: undefined,
      { input }: { input: ProjectNotificationsRulePointer },
      { user, factories }: ResolverContextWithUser
    ): Promise<ProjectNotificationsRuleDBScheme | null> {
      const project = await factories.projectsFactory.findById(input.projectId);

      if (!project) {
        throw new ApolloError('No project with such id');
      }

      return project.toggleNotificationsRuleEnabledState(input.ruleId);
    },
  },
};
