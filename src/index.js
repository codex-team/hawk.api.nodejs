const { ApolloServer } = require('apollo-server-express');
const express = require('express');
const jwt = require('jsonwebtoken');

const hawkDBConnection = require('./db/connection');
const requireAuthDirective = require('./directives/requireAuthDirective');

const resolvers = require('./resolvers');
const typeDefs = require('./typeDefs');

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
      mongoURLAPI:
        process.env.MONGO_URL_API || 'mongodb://localhost:27017/hawk',
      mongoURLEvents:
        process.env.MONGO_URL_EVENTS || 'mongodb://localhost:27017/events'
    };

    this.app = express();

    this.server = new ApolloServer({
      typeDefs,
      resolvers,
      schemaDirectives: {
        requireAuth: requireAuthDirective
      },
      context: HawkAPI.createContext
    });

    this.server.applyMiddleware({ app: this.app });
  }

  /**
   * Creates request context
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   * @return {Promise<Context>} - context
   */
  static async createContext({ req, res }) {
    const user = {};

    let accessToken = req.headers['authorization'];

    if (accessToken && accessToken.startsWith('Bearer ')) {
      accessToken = accessToken.slice(7);
      try {
        const data = await jwt.verify(accessToken, process.env.JWT_SECRET);

        user.id = data.userId;
      } catch (err) {
        console.log('Invalid token', err);
      }
    }

    return { user };
  }

  /**
   * Start API server
   *
   * @returns {Promise<void>}
   */
  async start() {
    // Connect to databases
    hawkDBConnection.createConnections(
      this.config.mongoURLAPI,
      this.config.mongoURLEvents
    );

    return new Promise((resolve, reject) => {
      this.app.listen({ port: this.config.port }, e => {
        if (e) return reject(e);

        console.log(
          `[${process.env.NODE_ENV}]🚀 Server ready at :${this.config.port}${
            this.server.graphqlPath
          }`
        );
        resolve();
      });
    });
  }
}

module.exports = {
  HawkAPI
};
