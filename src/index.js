import { resolve } from 'path';
import dotenv from 'dotenv';
import { ApolloServer } from 'apollo-server-express';
import express from 'express';
import mongoose from 'mongoose';

import { resolvers } from './resolvers';
import { typeDefs } from './typeDefs';
import { checkUserMiddleware } from './auth';

dotenv.config({ path: resolve(__dirname, '../.env') });

const startServer = async () => {
  const app = express();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req, res }) => ({
      req,
      res
    })
  });

  try {
    await mongoose.connect(
      process.env.MONGO_URL || 'mongodb://localhost:27017/',
      {
        useNewUrlParser: true
      }
    );
  } catch (err) {
    console.error(err);
    process.exit(1);
  }

  app.use(checkUserMiddleware);

  server.applyMiddleware({ app });

  app.listen({ port: 4000 }, () =>
    console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`)
  );
};

startServer();
