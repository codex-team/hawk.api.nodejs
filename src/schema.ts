import resolvers from './resolvers';
import typeDefs from './typeDefs';
import {makeExecutableSchema} from "@graphql-tools/schema";
import renameFromDirective from "./directives/renameFrom";
import { mergeTypeDefs } from '@graphql-tools/merge'
import defaultValueDirective from "./directives/defaultValue";
import validateDirective from "./directives/validate";


const { renameFromDirectiveTypeDefs, renameFromDirectiveTransformer } = renameFromDirective()
const { defaultValueDirectiveTypeDefs, defaultValueDirectiveTransformer } = defaultValueDirective()
const { validateDirectiveTypeDefs, validateDirectiveTransformer } = validateDirective()


let schema = makeExecutableSchema({
  typeDefs: mergeTypeDefs([
    renameFromDirectiveTypeDefs,
    defaultValueDirectiveTypeDefs,
    validateDirectiveTypeDefs,
    ...typeDefs
  ]),
  resolvers,
})

schema = renameFromDirectiveTransformer(schema);
schema = defaultValueDirectiveTransformer(schema);
schema = validateDirectiveTransformer(schema);

export default schema;
