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
];

export default resolvers;
