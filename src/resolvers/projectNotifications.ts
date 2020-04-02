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

interface UpdateProjectNotificationsRuleMutationPayload extends CreateProjectNotificationsRuleMutationPayload {
  /**
   * Rule id to update
   */
  ruleId: string;
}

interface DeleteProjectNotificationsRuleMutationPayload {
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
    ): Promise<void> {
      const project = await factories.projectsFactory.findById(input.projectId);

      if (!project) {
        throw new ApolloError('No project with such id');
      }

      if (!Object.keys(input.channels).length) {
        throw new UserInputError('At least one channel is required');
      }

      return project.updateNotificationsRule({
        ...input,
        uidAdded: user.id,
      });
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
      { input }: { input: DeleteProjectNotificationsRuleMutationPayload },
      { user, factories }: ResolverContextWithUser
    ): Promise<boolean> {
      const project = await factories.projectsFactory.findById(input.projectId);

      if (!project) {
        throw new ApolloError('No project with such id');
      }

      await project.deleteNotificationsRule(input.ruleId);

      return true;
    },
  },
};
