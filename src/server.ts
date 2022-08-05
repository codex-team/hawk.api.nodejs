import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageLocalDefault
} from 'apollo-server-core';
import type { ApolloServerPlugin } from 'apollo-server-plugin-base';
import fastify, { FastifyInstance } from 'fastify';
import schema from './schema.js';
import { ApolloServer } from './lib/apollo-server.js';


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


  // const createContext = (ctx: FastifyContext) => {
  //
  // };

  const server = new ApolloServer({
    schema,
    csrfPrevention: true,
    cache: 'bounded',
    // context: createContext,
    plugins: [
      fastifyAppClosePlugin(app),
      ApolloServerPluginDrainHttpServer({ httpServer: app.server }),
      ApolloServerPluginLandingPageLocalDefault({ embed: true }),
    ],
  });

  await server.start();
  app.register(server.createHandler());
  const PORT = 3000;

  await app.listen({
    port: PORT,
    host: '0.0.0.0',
  });
  console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`);
}
