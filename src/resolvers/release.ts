import ReleasesFactory from '../models/releaseFactory';

export default {
  Query: {
    /**
     * Fetch all releases or releases filtered by projectId
     * @param {ResolverObj} _ - Parent object, not used
     * @param {ResolverArgs} args - Query arguments
     * @param {ContextFactories} context - Global GraphQL context with factories
     * @returns {Promise<Release[]>}
     */
    getReleases: async (_: any, args: { projectId?: string }, { factories }: any) => {
      try {
        if (args.projectId) {
          return await factories.releasesFactory.getReleasesByProjectId(args.projectId);
        }
        return await factories.releasesFactory.getAllReleases();
      } catch (error) {
        console.error('Error fetching releases:', error);
        throw new Error('Не удалось получить релизы');
      }
    },
  },
};
