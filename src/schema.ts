import resolvers from './resolvers';
import typeDefs from './typeDefs';
import {makeExecutableSchema} from "@graphql-tools/schema";
import renameFromDirective from "./directives/renameFrom";
import { mergeTypeDefs } from '@graphql-tools/merge'
import defaultValueDirective from "./directives/defaultValue";


const { renameFromDirectiveTypeDefs, renameFromDirectiveTransformer } = renameFromDirective()
const { defaultValueDirectiveTypeDefs, defaultValueDirectiveTransformer } = defaultValueDirective()


let schema = makeExecutableSchema({
  typeDefs: mergeTypeDefs([
    renameFromDirectiveTypeDefs,
    defaultValueDirectiveTypeDefs,
    ...typeDefs
  ]),
  resolvers,
})

schema = renameFromDirectiveTransformer(schema);
schema = defaultValueDirectiveTransformer(schema);

export default schema;
