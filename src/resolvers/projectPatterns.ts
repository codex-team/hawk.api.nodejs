import { ResolverContextWithUser } from "../types/graphql";
import { ApolloError } from 'apollo-server-express';
import { ProjectEventGroupingPatternsDBScheme } from "@hawk.so/types";

/**
 * Type that represents payload for create project pattern mutation
 */
interface CreateProjectPatternMutationPayload {
  /**
   * Id of the project to create new pattern
   */
  projectId: string;

  /**
   * New pattern to be inserted
   */
  pattern: string;
};

/**
 * Type that represents payload for update project pattern mutation
 */
interface UpdateProjectPatternMutationPayload {
  /**
   * Id of the pattern to be updated
   */
  id: string,

  /**
   * ProjectId of the pattern to be updated
   */
  projectId: string,

  /**
   * New pattern
   */
  pattern: string,
};

/**
 * Type that represents payload for remove project pattern mutation
 */
interface RemoveProjectPatternMutationPayload {
  id: string,

  projectId: string,
}

export default {
  Mutation: {
    /**
     * Creates new events grouping pattern
     * @param _obj - parent object
     * @param user - current authorized user {@see ../index.js}
     * @param factories - factories for working with models
     * @param input - input data for creating
     */
    async createProjectEventGroupingPattern(
      _obj: undefined,
      { input }: { input: CreateProjectPatternMutationPayload },
      { user, factories }: ResolverContextWithUser
    ): Promise<ProjectEventGroupingPatternsDBScheme> {
      const project = await factories.projectsFactory.findById(input.projectId);

      if (!project) {
        throw new ApolloError('No project with such id');
      }

      const existingPatterns = await project.getProjectPatterns();

      existingPatterns.forEach(pattern => {
        if (pattern.pattern.match(new RegExp(input.pattern)) || input.pattern.match(new RegExp(pattern.pattern))) {
          throw new ApolloError('New pattern collides with existing one')
        } 
      })

      return await project.createProjectEventGroupingPattern({ pattern: input.pattern });
    },

    /**
     * Updates one events grouping pattern
     * @param _obj - parent object
     * @param user - current authorized user {@see ../index.js}
     * @param factories - factories for working with models
     * @param input - input data for creating
     */
    async updateProjectEventGroupingPattern(
      _obj: undefined,
      { input }: { input: UpdateProjectPatternMutationPayload },
      { user, factories }: ResolverContextWithUser  
    ): Promise<ProjectEventGroupingPatternsDBScheme> {
      const project = await factories.projectsFactory.findById(input.projectId);

      if (!project) {
        throw new ApolloError('No project with such id');
      }

      const existingPatterns = await project.getProjectPatterns();

      existingPatterns.forEach(pattern => {
        if (pattern._id.toString() !== input.id) {
          if (pattern.pattern.match(new RegExp(input.pattern)) || input.pattern.match(new RegExp(pattern.pattern))) {
            throw new ApolloError('New pattern collides with existing one')
          } 
        }
      });

      return await project.updateProjectEventGroupingPattern(input);
    },

    /**
     * Updates one events grouping pattern
     * @param _obj - parent object
     * @param user - current authorized user {@see ../index.js}
     * @param factories - factories for working with models
     * @param input - input data for creating
     */ 
    async removeProjectEventGroupingPattern(
      obj: undefined,
      { input }: { input: RemoveProjectPatternMutationPayload },
      { user, factories }: ResolverContextWithUser  
    ): Promise<ProjectEventGroupingPatternsDBScheme> {
      const project = await factories.projectsFactory.findById(input.projectId);

      if (!project) {
        throw new ApolloError('No project with such id');
      }

      return await project.removeProjectEventGroupingPattern({ id: input.id });
    }
  }
}