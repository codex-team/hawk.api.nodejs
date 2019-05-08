import { resolve } from 'path';
import dotenv from 'dotenv';
import { ApolloServer } from 'apollo-server-express';
import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';

import { resolvers } from './resolvers';
import { typeDefs } from './typeDefs';

dotenv.config({ path: resolve(__dirname, '../.env') });

const startServer = async () => {
  const app = express();

  app.use(cookieParser());

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req, res }) => ({
      req,
      res
    })
  });

  server.applyMiddleware({ app });

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

  app.listen({ port: 4000 }, () =>
    console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`)
  );
};

startServer();
