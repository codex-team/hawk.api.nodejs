import userResolver from './user.js';
const indexResolver = {
  Query: {
    /**
     * Healthcheck endpoint
     */
    health: () => 'ok',
  },
};

const resolvers = [
  indexResolver,
  userResolver,
];

export default resolvers;
