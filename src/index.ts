import './typeDefs/expressContext';
import { ApolloServer } from 'apollo-server-express';
import express from 'express';
import * as mongo from './mongo';
import * as rabbitmq from './rabbitmq';
import jwt, { Secret } from 'jsonwebtoken';
import http from 'http';
import { ExpressContext } from 'apollo-server-express/dist/ApolloServer';
import { ContextFactories, ResolverContextBase, UserJWTData } from './types/graphql';
import UsersFactory from './models/usersFactory';
import { GraphQLError } from 'graphql';
import WorkspacesFactory from './models/workspacesFactory';
import DataLoaders from './dataLoaders';
import HawkCatcher from '@hawk.so/nodejs';
// import { express as voyagerMiddleware } from 'graphql-voyager/middleware';
/*
 * @ts-ignore
 * import Accounting from 'codex-accounting-sdk';
 */
import Billing from './billing';
import bodyParser from 'body-parser';
import { ApolloServerPluginLandingPageGraphQLPlayground, ApolloServerPluginLandingPageDisabled } from 'apollo-server-core';
import ProjectsFactory from './models/projectsFactory';
import { NonCriticalError } from './errors';
import PlansFactory from './models/plansFactory';
import BusinessOperationsFactory from './models/businessOperationsFactory';
import schema from './schema';
import { graphqlUploadExpress } from 'graphql-upload';
import morgan from 'morgan';

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
    /**
     * Allow CORS requests.
     */
    this.app.use(async (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', `${process.env.GARAGE_URL}`);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT');
      res.setHeader('Access-Control-Allow-Headers', 'Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers');
      next();
    });

    /**
     * Setup request logger.
     * Uses 'combined' format in production for Apache-style logging,
     * and 'dev' format in development for colored, concise output.
     */
    this.app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

    this.app.use(express.json());
    this.app.use(bodyParser.urlencoded({ extended: false }));
    this.app.use('/static', express.static(`./static`));

    /**
     * Add context to the express request object to use its methods in any requests
     */
    this.app.use(async (req, res, next) => {
      req.context = await HawkAPI.createContext({ req } as ExpressContext);
      next();
    });

    const billing = new Billing();

    billing.appendRoutes(this.app);

    this.server = new ApolloServer({
      schema,
      debug: process.env.NODE_ENV === 'development',
      // csrfPrevention: true,
      introspection: PLAYGROUND_ENABLE,
      plugins: [
        process.env.NODE_ENV === 'production'
          ? ApolloServerPluginLandingPageDisabled()
          : ApolloServerPluginLandingPageGraphQLPlayground(),
      ],
      context: ({ req }): ResolverContextBase => req.context,
      formatError: (error): GraphQLError => {
        if (error.originalError instanceof NonCriticalError) {
          return error;
        }
        console.error(error.originalError);

        if (error.originalError instanceof Error) {
          HawkCatcher.send(error.originalError);
        }

        return error;
      },
    });

    /**
     * In apollo-server-express integration it is necessary to use existing HTTP server to use GraphQL subscriptions
     * {@see https://www.apollographql.com/docs/apollo-server/features/subscriptions/#subscriptions-with-additional-middleware}
     */
    this.httpServer = http.createServer(this.app);
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

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const projectsFactory = new ProjectsFactory(mongo.databases.hawk!, dataLoaders);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const plansFactory = new PlansFactory(mongo.databases.hawk!, dataLoaders);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const businessOperationsFactory = new BusinessOperationsFactory(mongo.databases.hawk!, dataLoaders);

    return {
      usersFactory,
      workspacesFactory,
      projectsFactory,
      plansFactory,
      businessOperationsFactory,
    };
  }

  /**
   * Creates request context
   * @param req - Express request
   * @param connection - websocket connection (for subscriptions)
   */
  private static async createContext({ req }: ExpressContext): Promise<ResolverContextBase> {
    let userId: string | undefined;
    let isAccessTokenExpired = false;

    const authorizationHeader = req.headers.authorization;

    if (
      authorizationHeader &&
      /^Bearer [a-z0-9-_+/=]+\.[a-z0-9-_+/=]+\.[a-z0-9-_+/=]+$/i.test(
        authorizationHeader
      )
    ) {
      const accessToken = authorizationHeader.slice(7);

      try {
        const data = await jwt.verify(accessToken, process.env.JWT_SECRET_ACCESS_TOKEN as Secret) as UserJWTData;

        userId = data.userId;
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
          isAccessTokenExpired = true;
        }
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const dataLoader = new DataLoaders(mongo.databases.hawk!);

    /**
     * Initializing accounting SDK
     */
    let tlsVerify;

    /**
     * Checking env variables
     * If at least one path is not transmitted, the variable tlsVerify is undefined
     */
    if (
      ![process.env.TLS_CA_CERT, process.env.TLS_CERT, process.env.TLS_KEY].some(value => value === undefined || value.length === 0)
    ) {
      tlsVerify = {
        tlsCaCertPath: `${process.env.TLS_CA_CERT}`,
        tlsCertPath: `${process.env.TLS_CERT}`,
        tlsKeyPath: `${process.env.TLS_KEY}`,
      };
    }

    /*
     * const accounting = new Accounting({
     *   baseURL: `${process.env.CODEX_ACCOUNTING_URL}`,
     *   tlsVerify,
     * });
     */

    return {
      factories: HawkAPI.setupFactories(dataLoader),
      user: {
        id: userId,
        accessTokenExpired: isAccessTokenExpired,
      },
      // accounting,
    };
  }

  /**
   * Start API server
   */
  public async start(): Promise<void> {
    await mongo.setupConnections();
    await rabbitmq.setupConnections();
    await this.server.start();
    this.app.use(graphqlUploadExpress());
    this.server.applyMiddleware({ app: this.app });

    return new Promise((resolve) => {
      this.httpServer.listen({ port: this.serverPort }, () => {
        console.log(
          `🚀 Server ready at http://localhost:${this.serverPort}${this.server.graphqlPath
          }`
        );
        resolve();
      });
    });
  }
}

export default HawkAPI;
