import resolvers from './resolvers';
import typeDefs from './typeDefs';
import {makeExecutableSchema} from "@graphql-tools/schema";
import renameFromDirective from "./directives/renameFrom";
import { mergeTypeDefs } from '@graphql-tools/merge'
import defaultValueDirective from "./directives/defaultValue";
import validateDirective from "./directives/validate";
import uploadImageDirective from "./directives/uploadImageDirective";


const { renameFromDirectiveTypeDefs, renameFromDirectiveTransformer } = renameFromDirective()
const { defaultValueDirectiveTypeDefs, defaultValueDirectiveTransformer } = defaultValueDirective()
const { validateDirectiveTypeDefs, validateDirectiveTransformer } = validateDirective()
const { uploadImageDirectiveTypeDefs, uploadImageDirectiveTransformer } = uploadImageDirective()


let schema = makeExecutableSchema({
  typeDefs: mergeTypeDefs([
    renameFromDirectiveTypeDefs,
    defaultValueDirectiveTypeDefs,
    validateDirectiveTypeDefs,
    uploadImageDirectiveTypeDefs,
    ...typeDefs
  ]),
  resolvers,
})

schema = renameFromDirectiveTransformer(schema);
schema = defaultValueDirectiveTransformer(schema);
schema = validateDirectiveTransformer(schema);
schema = uploadImageDirectiveTransformer(schema);

export default schema;
