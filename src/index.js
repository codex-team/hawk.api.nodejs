const { ApolloServer } = require('apollo-server-express');
const express = require('express');
const mongoose = require('mongoose');

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
      mongoURL:
        process.env.MONGO_URL ||
        'mongodb://root:root@localhost:27017/hawk?authSource=admin'
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
