import resolvers from './resolvers';
import typeDefs from './typeDefs';
import { makeExecutableSchema } from '@graphql-tools/schema';
import renameFromDirective from './directives/renameFrom';
import { mergeTypeDefs } from '@graphql-tools/merge';
import defaultValueDirective from './directives/defaultValue';
import validateDirective from './directives/validate';
import uploadImageDirective from './directives/uploadImageDirective';
import allowAnonDirective from './directives/allowAnon';
import requireAdminDirective from './directives/requireAdmin';
import requireUserInWorkspaceDirective from './directives/requireUserInWorkspace';
import definedOnlyForAdminsDirective from './directives/definedOnlyForAdmins';

const { renameFromDirectiveTypeDefs, renameFromDirectiveTransformer } = renameFromDirective();
const { defaultValueDirectiveTypeDefs, defaultValueDirectiveTransformer } = defaultValueDirective();
const { validateDirectiveTypeDefs, validateDirectiveTransformer } = validateDirective();
const { uploadImageDirectiveTypeDefs, uploadImageDirectiveTransformer } = uploadImageDirective();
const { allowAnonDirectiveTypeDefs, allowAnonDirectiveTransformer } = allowAnonDirective();
const { requireAdminDirectiveTypeDefs, requireAdminDirectiveTransformer } = requireAdminDirective();
const { requireUserInWorkspaceDirectiveTypeDefs, requireUserInWorkspaceDirectiveTransformer } = requireUserInWorkspaceDirective();
const { definedOnlyForAdminsDirectiveTypeDefs, definedOnlyForAdminsDirectiveTransformer } = definedOnlyForAdminsDirective();

let schema = makeExecutableSchema({
  typeDefs: mergeTypeDefs([
    renameFromDirectiveTypeDefs,
    defaultValueDirectiveTypeDefs,
    validateDirectiveTypeDefs,
    uploadImageDirectiveTypeDefs,
    allowAnonDirectiveTypeDefs,
    requireAdminDirectiveTypeDefs,
    requireUserInWorkspaceDirectiveTypeDefs,
    definedOnlyForAdminsDirectiveTypeDefs,
    ...typeDefs,
  ]),
  resolvers,
});

schema = renameFromDirectiveTransformer(schema);
schema = defaultValueDirectiveTransformer(schema);
schema = validateDirectiveTransformer(schema);
schema = uploadImageDirectiveTransformer(schema);
schema = requireAdminDirectiveTransformer(schema);
schema = allowAnonDirectiveTransformer(schema);
schema = requireUserInWorkspaceDirectiveTransformer(schema);
schema = definedOnlyForAdminsDirectiveTransformer(schema);

export default schema;
