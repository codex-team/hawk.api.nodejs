import {ApolloServer} from 'apollo-server-express';
import express from 'express';
import * as mongo from './mongo';
import * as rabbitmq from './rabbitmq';
import jwt from 'jsonwebtoken';
import http from 'http';
import billing from './billing/index';
import {initializeStrategies} from './passport';
import {authRouter} from './auth';
import resolvers from './resolvers';
import typeDefs from './typeDefs';
import {ExpressContext} from 'apollo-server-express/dist/ApolloServer';
import {ContextFactories, ResolverContextBase, UserJWTData} from './types/graphql';
import UsersFactory from "./models/usersFactory";

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

  private factories?: ContextFactories;

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
        renameFrom: require('./directives/renameFrom')
      },
      subscriptions: {
        path: '/subscriptions',
        onConnect: HawkAPI.onWebSocketConnection
      },
      context: this.createContext,
      formatError: error => {
        console.error(error.originalError);
        return error;
      }
    });

    this.server.applyMiddleware({app: this.app});
    /**
     * In apollo-server-express integration it is necessary to use existing HTTP server to use GraphQL subscriptions
     * {@see https://www.apollographql.com/docs/apollo-server/features/subscriptions/#subscriptions-with-additional-middleware}
     */
    this.httpServer = http.createServer(this.app);
    this.server.installSubscriptionHandlers(this.httpServer);
  }

  /**
   * Creates request context
   * @param req - Express request
   * @param connection - websocket connection (for subscriptions)
   */
  async createContext({req, connection}: ExpressContext): Promise<ResolverContextBase> {
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
        const data = await jwt.verify(accessToken, process.env.JWT_SECRET || 'secret') as UserJWTData;

        userId = data.userId;
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
          isAccessTokenExpired = true;
        }
      }
    }

    return {
      factories: this.factories!,
      user: {
        id: userId,
        accessTokenExpired: isAccessTokenExpired
      }
    }
  }

  /**
   * Fires when coming new Websocket connection
   * Returns authorization headers for building request context
   * @param connectionParams
   * @return - context for subscription request
   */
  static async onWebSocketConnection(connectionParams: any) {
    return {
      headers: {
        authorization:
          connectionParams['authorization'] || connectionParams['Authorization']
      }
    };
  }

  /**
   * Start API server
   */
  async start(): Promise<void> {
    await mongo.setupConnections();
    await rabbitmq.setupConnections();
    this.setupFactories();

    return new Promise((resolve) => {
      this.httpServer.listen({port: this.serverPort}, () => {
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

  private setupFactories(): void {
    const usersFactory = new UsersFactory(mongo.databases.hawk!, 'users');

    this.factories = {
      usersFactory
    }
  }
}

export default HawkAPI;
