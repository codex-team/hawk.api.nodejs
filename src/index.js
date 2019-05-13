const { ApolloServer } = require('apollo-server-express');
const express = require('express');
const mongoose = require('mongoose');

const { resolvers } = require('./resolvers');
const { typeDefs } = require('./typeDefs');

const startServer = async () => {};

startServer();

/**
 *
 *
 * @class HawkAPI
 */
class HawkAPI {
  /**
   *Creates an instance of HawkAPI.
   * @memberof HawkAPI
   */
  constructor() {
    this.config = {
      port: process.env.PORT || 4000,
      mongoURL: process.env.MONGO_URL || 'mongodb://localhost:27017/'
    };

    this.app = express();

    const server = new ApolloServer({
      typeDefs,
      resolvers
    });

    server.applyMiddleware({ app: this.app });
  }

  /**
   *
   *
   * @memberof HawkAPI
   */
  async start() {
    await mongoose.connect(this.config.mongoURL, {
      useNewUrlParser: true
    });

    app.listen({ port: this.config.port }, () =>
      console.log(
        `🚀 Server ready at :${this.config.port}${server.graphqlPath}`
      )
    );
  }
}

module.exports = {
  HawkAPI
};
