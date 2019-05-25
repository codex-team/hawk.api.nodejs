const { ApolloServer } = require('apollo-server-express');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

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
      resolvers,
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
    /**
     * @const {Context}
     */
    const context = {
      user: null
    };

    let accessToken = req.headers['authorization'];

    if (!accessToken) {
      if (accessToken.startsWith('Bearer ')) {
        accessToken = accessToken.slice(7);
        try {
          const data = await jwt.verify(accessToken, process.env.JWT_SECRET);

          context.user.id = data.id;
        } catch (err) {
        }
      }
    }

    return context;
  }

  /**
   * Start API server
   *
   * @returns {Promise<void>}
   */
  async start() {
    await mongoose.connect(this.config.mongoURL, {
      useNewUrlParser: true,
      useCreateIndex: true
    });

    return new Promise((resolve, reject) => {
      this.app.listen({ port: this.config.port }, e => {
        if (e) return reject(e);

        console.log(
          `🚀 Server ready at :${this.config.port}${this.server.graphqlPath}`
        );
        resolve();
      });
    });
  }
}

module.exports = {
  HawkAPI
};
