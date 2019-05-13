const { ApolloServer } = require('apollo-server-express');
const express = require('express');
const mongoose = require('mongoose');

const resolvers = require('./resolvers');
const typeDefs = require('./typeDefs');

const startServer = async () => {};

startServer();

/**
 * Hawk API server
 *
 * @class HawkAPI
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
   *
   * @memberof HawkAPI
   */
  constructor() {
    this.config = {
      port: +process.env.PORT || 4000,
      mongoURL: process.env.MONGO_URL || 'mongodb://localhost:27017/'
    };

    this.app = express();

    this.server = new ApolloServer({
      typeDefs,
      resolvers
    });

    this.server.applyMiddleware({ app: this.app });
  }

  /**
   * Start API server
   *
   * @memberof HawkAPI
   * @returns {Promise<void>}
   */
  async start() {
    await mongoose.connect(this.config.mongoURL, {
      useNewUrlParser: true
    });

    this.app.listen({ port: this.config.port }, () =>
      console.log(
        `🚀 Server ready at :${this.config.port}${this.server.graphqlPath}`
      )
    );
  }
}

module.exports = {
  HawkAPI
};
