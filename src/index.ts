import {ApolloServer} from 'apollo-server-express';
import express, {Request} from 'express';
import mongo from './mongo';
import rabbitmq from './rabbitmq';
import jwt from 'jsonwebtoken';
import http from 'http';
import billing from './billing/index';
import {initializeStrategies} from './passport';
import {authRouter} from './auth';
import resolvers from './resolvers';
import typeDefs from './typeDefs';
import {ExpressContext} from 'apollo-server-express/dist/ApolloServer';
import {ResolverContextBase, UserInContext, UserJWTData} from './types/graphql';

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
 *
 * @property {Express} app - Express app.
 * @property {ApolloServer} server - GraphQL Apollo server.
 * @property {object} config - config object.
 * @property {number} config.port - serving port.
 * @property {string} config.mongoURL - MongoDB URL.
 */
class HawkAPI {
  /**
   * Creates an instance of HawkAPI.
   * Requires PORT and MONGO_URL env vars to be set.
   */

  private config = {
    port: +(process.env.PORT || 4000),
    mongoURL: process.env.MONGO_URL || 'mongodb://localhost:27017/hawk'
  };

  private app = express();
  private server: ApolloServer;
  private httpServer: http.Server;

  constructor() {
    this.app.use(express.json());
    this.app.post('/billing', billing.notifyCallback);
    this.app.use(authRouter);

    initializeStrategies();

    this.server = new ApolloServer({
      typeDefs,
      debug: false,
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
      context: HawkAPI.createContext,
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
   * @param {Request} req - Express request
   * @param {Object} connection - websocket connection (for subscriptions)
   * @return {Promise<Context>} - context
   */
  static async createContext({req, connection}: ExpressContext): Promise<ResolverContextBase> {
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

    return new Promise((resolve) => {
      this.httpServer.listen({port: this.config.port}, () => {
        console.log(
          `🚀 Server ready at http://localhost:${this.config.port}${
            this.server.graphqlPath
          }`
        );
        console.log(
          `🚀 Subscriptions ready at ws://localhost:${this.config.port}${
            this.server.subscriptionsPath
          }`
        );
        resolve();
      });
    });
  }
}

export default HawkAPI;
