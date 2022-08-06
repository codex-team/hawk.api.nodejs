import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageLocalDefault
} from 'apollo-server-core';
import type { ApolloServerPlugin } from 'apollo-server-plugin-base';
import fastify, { FastifyInstance } from 'fastify';
import schema from './schema.js';
import { ApolloServer } from './lib/apollo-server.js';
import config from './lib/config.js';


/**
 * Plugin for draining the HTTP server.
 *
 * @param app - fastify instance for server manipulation
 */
function fastifyAppClosePlugin(app: FastifyInstance): ApolloServerPlugin {
  return {
    async serverWillStart() {
      return {
        async drainServer() {
          await app.close();
        },
      };
    },
  };
}

/**
 * Creates and starts server instance
 */
export default async function startApolloServer(): Promise<void> {
  const app = fastify();

  const server = new ApolloServer({
    schema,
    csrfPrevention: true,
    cache: 'bounded',
    plugins: [
      fastifyAppClosePlugin(app),
      ApolloServerPluginDrainHttpServer({ httpServer: app.server }),
      ApolloServerPluginLandingPageLocalDefault({ embed: true }),
    ],
  });

  await server.start();
  app.register(server.createHandler());

  await app.listen({
    port: config.port,
    host: config.host,
  });
  console.log(`🚀 Server ready at http://${config.host}:${config.port}${server.graphqlPath}`);
}
