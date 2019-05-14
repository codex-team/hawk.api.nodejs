const { ApolloServer, ApolloError } = require('apollo-server-express');
const express = require('express');
const mongoose = require('mongoose');

const { checkUserMiddleware } = require('./middlewares/auth');
const resolvers = require('./resolvers');
const typeDefs = require('./typeDefs');

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

    this.app.use(checkUserMiddleware);

    this.server = new ApolloServer({
      typeDefs,
      resolvers,
      context: ({ req, res }) => ({ req, res }),
      formatError: err => {
        if (err.extensions.exception.name === 'MongoError') {
          // TODO: apollo doesn't work with this, although it's from their guide
          return new Error('Internal server error');
        }

        return err;
      }
    });

    this.server.applyMiddleware({ app: this.app });
  }

  /**
   * Start API server
   *
   * @returns {Promise<void>}
   */
  async start() {
    await mongoose.connect(this.config.mongoURL, {
      useNewUrlParser: true
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
