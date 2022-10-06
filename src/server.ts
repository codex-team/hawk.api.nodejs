import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageLocalDefault
} from 'apollo-server-core';
import type { ApolloServerPlugin } from 'apollo-server-plugin-base';
import fastify, { FastifyInstance, FastifyRequest } from 'fastify';
import schema from './schema.js';
import { ApolloServer, FastifyContext } from './lib/apollo-server.js';
import config from './lib/config.js';
import logger, { getLogger } from './lib/logger.js';
import runMetricsServer from './lib/metrics.js';
import type { ResolverContextBase } from './types/graphql.js';
import { verifyAccessToken } from './lib/auth-tokens.js';
import authRoutes from './routes/auth.js';
import type { FastifyCookieOptions } from '@fastify/cookie';
import cookie from '@fastify/cookie';

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
 * Extracts access token from request (from cookie or from header)
 *
 * @param request - fastify request
 */
function getAccessToken(request: FastifyRequest): string {
  const authHeader = request.headers.authorization;

  if (authHeader) {
    return authHeader?.slice('Bearer '.length) || '';
  }

  const accessToken = request.cookies['accessToken'];

  return accessToken || '';
}

/**
 * Creates context for request
 *
 * @param context - Fastify context
 */
async function createContext({ request }: FastifyContext): Promise<ResolverContextBase> {
  const accessToken = getAccessToken(request);

  let userId: string | undefined;
  let isAccessTokenExpired = false;

  try {
    const data = await verifyAccessToken(accessToken);

    userId = data.userId;
  } catch (err) {
    logger.error(err);
    isAccessTokenExpired = true;
  }


  return {
    user: {
      id: userId,
      accessTokenExpired: isAccessTokenExpired,
    },
  };
}

/**
 * Creates and starts server instance
 */
export default async function startApolloServer(): Promise<void> {
  const appServerLogger = getLogger('appServer');

  const app = fastify({
    logger: appServerLogger,
  });

  app.register(cookie, {
    secret: 'my-secret',
    // parseOptions: {},
  } as FastifyCookieOptions);
  app.register(authRoutes);

  const server = new ApolloServer({
    schema,
    csrfPrevention: true,
    cache: 'bounded',
    context: createContext,
    plugins: [
      fastifyAppClosePlugin(app),
      ApolloServerPluginDrainHttpServer({ httpServer: app.server }),
      ApolloServerPluginLandingPageLocalDefault({ embed: true }),
    ],
  });

  await server.start();
  app.register(server.createHandler());

  if (config.metrics.enabled) {
    await runMetricsServer();
  }


  await app.listen({
    port: config.port,
    host: config.host,
  });
  logger.info(`🚀 Server ready at http://${config.host}:${config.port}${server.graphqlPath}`);
}
