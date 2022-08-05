import resolvers from './resolvers/index.js';
import typeDefs from './typedefs/index.js';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { mergeTypeDefs } from '@graphql-tools/merge';

const schema = makeExecutableSchema({
  typeDefs: mergeTypeDefs([
    ...typeDefs,
  ]),
  resolvers,
});

export default schema;
