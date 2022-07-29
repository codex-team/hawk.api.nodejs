import resolvers from './resolvers';
import typeDefs from './typeDefs';
import {makeExecutableSchema} from "@graphql-tools/schema";
import renameFromDirective from "./directives/renameFrom";
import { mergeTypeDefs } from '@graphql-tools/merge'


const { renameFromDirectiveTypeDefs, renameFromDirectiveTransformer } = renameFromDirective()


let schema = makeExecutableSchema({
  typeDefs: mergeTypeDefs([
    renameFromDirectiveTypeDefs,
    ...typeDefs
  ]),
  resolvers,
})

schema = renameFromDirectiveTransformer(schema);

export default schema;
