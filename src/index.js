const { ApolloServer } = require('apollo-server-express');
const express = require('express');
const mongo = require('./mongo');
const jwt = require('jsonwebtoken');
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
      mongoURL: process.env.MONGO_URL || 'mongodb://localhost:27017/hawk'
    };

    this.app = express();

    this.server = new ApolloServer({
      typeDefs,
      debug: false,
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

    /*
     * @todo deny access by refresh tokens
     * @todo block used refresh token
     */

    let accessToken = req.headers['authorization'];

    if (accessToken && /^Bearer [a-z0-9-_+/=]+\.[a-z0-9-_+/=]+\.[a-z0-9-_+/=]+$/i.test(accessToken)) {
      accessToken = accessToken.slice(7);
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
   * Start API server
   *
   * @returns {Promise<void>}
   */
  async start() {
    await mongo.setupConnections();

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
