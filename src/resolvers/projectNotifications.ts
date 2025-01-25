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

      if (isChannelsEmpty(input.channels)) {
        throw new UserInputError('At least one channel is required');
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

      if (isChannelsEmpty(input.channels)) {
        throw new UserInputError('At least one channel is required');
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
