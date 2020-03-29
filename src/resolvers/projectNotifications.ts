import { NotificationsChannelsDBScheme, ProjectNotificationsRuleDBScheme, ReceiveTypes } from '../models/newProjectModel';
import { ResolverContextWithUser } from '../types/graphql';
import { ApolloError, UserInputError } from 'apollo-server-express';

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
}

/**
 * See all types and fields here {@see ../typeDefs/notify.graphql}
 */
export default {
  Mutation: {
    /**
     * Creates new rule for project notifications settings
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

      if (!Object.keys(input.channels).length) {
        throw new UserInputError('At least one channel is required');
      }

      /**
       * In GraphQL Schema there is default value for this field, but due to bug we have to specify default value manually
       * @see https://spectrum.chat/ariadne/general/default-value-for-enum~4ca31053-b8ab-4886-aba2-3899343ed9a4
       */
      if (!input.whatToReceive) {
        input.whatToReceive = ReceiveTypes.ONLY_NEW;
      }

      return project.createNotificationRule({
        ...input,
        uidAdded: user.id,
      });
    },
  },
};
