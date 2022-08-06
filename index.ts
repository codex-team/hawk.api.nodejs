import startApolloServer from './src/server.js';
import logger from './src/lib/logger.js';

logger.info('Starting server');
startApolloServer().catch(err => {
  logger.error(err);
  process.exit(1);
});
