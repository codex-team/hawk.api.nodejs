const { ApolloServer } = require('apollo-server-express');
const express = require('express');
const mongo = require('./mongo');
const jwt = require('jsonwebtoken');
const requireAuthDirective = require('./directives/requireAuthDirective');
const http = require('http');

const resolvers = require('./resolvers');
const typeDefs = require('./typeDefs');

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
  constructor() {
    this.config = {
      port: +process.env.PORT || 4000,
      mongoURL: process.env.MONGO_URL || 'mongodb://localhost:27017/hawk'
    };
    this.app = express();

    this.server = new ApolloServer({
      typeDefs,
      debug: false,
      resolvers,
      playground: PLAYGROUND_ENABLE,
      introspection: PLAYGROUND_ENABLE,
      schemaDirectives: {
        requireAuth: requireAuthDirective
      },
      subscriptions: {
        path: '/subscriptions',
        onConnect: HawkAPI.onWebSocketConnection
      },
      context: HawkAPI.createContext
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
   * Creates request context
   * @param {Request} req - Express request
   * @param {Object} connection - websocket connection (for subscriptions)
   * @return {Promise<Context>} - context
   */
  static async createContext({ req, connection }) {
    const user = {};
    /*
     * @todo deny access by refresh tokens
     * @todo block used refresh token
     */

    const authorizationHeader = connection ? connection.context.headers.authorization : req.headers['authorization'];

    if (authorizationHeader && /^Bearer [a-z0-9-_+/=]+\.[a-z0-9-_+/=]+\.[a-z0-9-_+/=]+$/i.test(authorizationHeader)) {
      const accessToken = authorizationHeader.slice(7);

      try {
        const data = await jwt.verify(accessToken, process.env.JWT_SECRET);

        user.id = data.userId;
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
          user.accessTokenExpired = true;
        }
      }
    }

    return { user };
  }

  /**
   * Fires when coming new Websocket connection
   * Returns authorization headers for building request context
   * @param {Object} connectionParams
   * @return {Promise<{headers: {authorization: string}}>} - context for subscription request
   */
  static async onWebSocketConnection(connectionParams) {
    return {
      headers: {
        authorization: connectionParams.authorization
      }
    };
  }

  /**
   * Start API server
   *
   * @returns {Promise<void>}
   */
  async start() {
    await mongo.setupConnections();

    return new Promise((resolve, reject) => {
      this.httpServer.listen({ port: this.config.port }, e => {
        if (e) return reject(e);

        console.log(`🚀 Server ready at http://localhost:${this.config.port}${this.server.graphqlPath}`);
        console.log(`🚀 Subscriptions ready at ws://localhost:${this.config.port}${this.server.subscriptionsPath}`);
        resolve();
      });
    });
  }
}

module.exports = {
  HawkAPI
};
