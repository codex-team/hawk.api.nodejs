import ReleasesFactory from '../models/releaseFactory';

export default {
  Query: {
    /**
     * Fetch releases by projectId
     * @param {ResolverObj} _ - Parent object, not used
     * @param {ResolverArgs} args - Query arguments containing required projectId 
     * @param {ContextFactories} context - Global GraphQL context with factories
     * @returns {Promise<Release[]>}
     */
    getReleases: async (_: any, args: { projectId: string }, { factories }: any) => {
      if (!args.projectId) {
        throw new Error('projectId is required to fetch releases');
      }

      try {
        return await factories.releasesFactory.findManyByProjectId(args.projectId);
      } catch (error) {
        console.error('Error fetching releases:', error);
        throw new Error('Failed to get the releases');
      }
    },
  },
};
