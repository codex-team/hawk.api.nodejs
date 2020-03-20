import { ApolloServer } from 'apollo-server-express';
import express from 'express';
import * as mongo from './mongo';
import * as rabbitmq from './rabbitmq';
import jwt from 'jsonwebtoken';
import http from 'http';
import billing from './billing/index';
import { initializeStrategies } from './passport';
import { authRouter } from './auth';
import resolvers from './resolvers';
import typeDefs from './typeDefs';
import { ExpressContext } from 'apollo-server-express/dist/ApolloServer';
import { ContextFactories, ResolverContextBase, UserJWTData } from './types/graphql';
import UsersFactory from './models/usersFactory';
import { GraphQLError } from 'graphql';
import WorkspacesFactory from './models/workspacesFactory';
import DataLoaders from './dataLoaders';

import UploadImageDirective from './directives/uploadImageDirective';
import RequireAdminDirective from './directives/requireAdminDirective';

/**
 * Option to enable playground
 */
const PLAYGROUND_ENABLE = process.env.PLAYGROUND_ENABLE === 'true';

/**
 * @typedef Context
 * @property {Object} user - current user
 * @property {String} user.id - current user id
 */

/**
 * Hawk API server
 */
class HawkAPI {
  /**
   * Port to listen for requests
   */
  private serverPort = +(process.env.PORT || 4000);

  /**
   * Express application
   */
  private app = express();

  /**
   * Apollo GraphQL server
   */
  private server: ApolloServer;

  /**
   * NodeJS http server
   */
  private readonly httpServer: http.Server;

  /**
   * Creates an instance of HawkAPI.
   * Requires PORT and MONGO_URL env vars to be set.
   */
  constructor() {
    this.app.use(express.json());
    this.app.post('/billing', billing.notifyCallback);
    this.app.use('/uploads', express.static(`./${process.env.UPLOADS_DIR || 'uploads'}`));
    this.app.use(authRouter);

    initializeStrategies();

    this.server = new ApolloServer({
      typeDefs,
      debug: true,
      resolvers,
      playground: PLAYGROUND_ENABLE,
      introspection: PLAYGROUND_ENABLE,
      schemaDirectives: {
        requireAuth: require('./directives/requireAuthDirective'),
        renameFrom: require('./directives/renameFrom'),
        uploadImage: UploadImageDirective,
        requireAdmin: RequireAdminDirective,
      },
      subscriptions: {
        path: '/subscriptions',
        onConnect: (connectionParams): { headers: { authorization: string } } =>
          HawkAPI.onWebSocketConnection(connectionParams as Record<string, string>),
      },
      context: (req: ExpressContext): Promise<ResolverContextBase> => HawkAPI.createContext(req),
      formatError: (error): GraphQLError => {
        console.error(error.originalError);

        return error;
      },
    });

    this.server.applyMiddleware({ app: this.app });
    /**
     * In apollo-server-express integration it is necessary to use existing HTTP server to use GraphQL subscriptions
     * {@see https://www.apollographql.com/docs/apollo-server/features/subscriptions/#subscriptions-with-additional-middleware}
     */
    this.httpServer = http.createServer(this.app);
    this.server.installSubscriptionHandlers(this.httpServer);
  }

  /**
   * Creates factories to work with models
   * @param dataLoaders - dataLoaders for fetching data form database
   */
  private static setupFactories(dataLoaders: DataLoaders): ContextFactories {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const usersFactory = new UsersFactory(mongo.databases.hawk!, dataLoaders);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const workspacesFactory = new WorkspacesFactory(mongo.databases.hawk!, dataLoaders);

    return {
      usersFactory,
      workspacesFactory,
    };
  }

  /**
   * Creates request context
   * @param req - Express request
   * @param connection - websocket connection (for subscriptions)
   */
  private static async createContext({ req, connection }: ExpressContext): Promise<ResolverContextBase> {
    let userId: string | undefined;
    let isAccessTokenExpired = false;

    /*
     * @todo deny access by refresh tokens
     * @todo block used refresh token
     */
    const authorizationHeader = connection
      ? connection.context.headers.authorization
      : req.headers.authorization;

    if (
      authorizationHeader &&
      /^Bearer [a-z0-9-_+/=]+\.[a-z0-9-_+/=]+\.[a-z0-9-_+/=]+$/i.test(
        authorizationHeader
      )
    ) {
      const accessToken = authorizationHeader.slice(7);

      try {
        const data = await jwt.verify(accessToken, process.env.JWT_SECRET_AUTH || 'secret') as UserJWTData;

        userId = data.userId;
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
          isAccessTokenExpired = true;
        }
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const dataLoader = new DataLoaders(mongo.databases.hawk!);

    return {
      factories: HawkAPI.setupFactories(dataLoader),
      user: {
        id: userId,
        accessTokenExpired: isAccessTokenExpired,
      },
    };
  }

  /**
   * Fires when coming new Websocket connection
   * Returns authorization headers for building request context
   * @param connectionParams - websocket connection params (actually, headers only)
   * @return - context for subscription request
   */
  private static onWebSocketConnection(connectionParams: Record<string, string>): { headers: { authorization: string } } {
    return {
      headers: {
        authorization:
          connectionParams['authorization'] || connectionParams['Authorization'],
      },
    };
  }

  /**
   * Start API server
   */
  public async start(): Promise<void> {
    await mongo.setupConnections();
    await rabbitmq.setupConnections();

    return new Promise((resolve) => {
      this.httpServer.listen({ port: this.serverPort }, () => {
        console.log(
          `🚀 Server ready at http://localhost:${this.serverPort}${
            this.server.graphqlPath
          }`
        );
        console.log(
          `🚀 Subscriptions ready at ws://localhost:${this.serverPort}${
            this.server.subscriptionsPath
          }`
        );
        resolve();
      });
    });
  }
}

export default HawkAPI;
