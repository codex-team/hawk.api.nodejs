import resolvers from './resolvers/index.js';
import typeDefs from './typedefs/index.js';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';
import requireAuthDirective from './directives/requireAuth.js';
import validateDirective from './directives/validate.js';
import defaultValueDirective from './directives/defaultValue.js';
import renameFromDirective from './directives/renameFrom.js';


const { renameFromDirectiveTypeDefs, renameFromDirectiveTransformer } = renameFromDirective();
const { defaultValueDirectiveTypeDefs, defaultValueDirectiveTransformer } = defaultValueDirective();
const { validateDirectiveTypeDefs, validateDirectiveTransformer } = validateDirective();
const { requireAuthDirectiveTypeDefs, requireAuthDirectiveTransformer } = requireAuthDirective();

let schema = makeExecutableSchema({
  typeDefs: mergeTypeDefs([
    renameFromDirectiveTypeDefs,
    defaultValueDirectiveTypeDefs,
    validateDirectiveTypeDefs,
    requireAuthDirectiveTypeDefs,
    ...typeDefs,
  ]),
  resolvers: mergeResolvers(resolvers),
});

schema = renameFromDirectiveTransformer(schema);
schema = defaultValueDirectiveTransformer(schema);
schema = validateDirectiveTransformer(schema);
schema = requireAuthDirectiveTransformer(schema);

export default schema;
