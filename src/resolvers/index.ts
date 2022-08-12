import userResolvers from './user.js';
import workspaceResolvers from './workspace.js';

const indexResolvers = {
  Query: {
    /**
     * Healthcheck endpoint
     */
    health: () => 'ok',
  },
};

const resolvers = [
  indexResolvers,
  userResolvers,
  workspaceResolvers,
];

export default resolvers;
