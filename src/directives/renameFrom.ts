import { defaultFieldResolver, GraphQLSchema } from 'graphql';
import { mapSchema, MapperKind, getDirective } from '@graphql-tools/utils';

/**
 * GraphQL directive for renaming one parent's field to another
 *
 * @param directiveName - name of the directive
 */
const renameFromDirective = (directiveName = 'renameFrom') => {
  return {
    renameFromDirectiveTypeDefs:`
    """
    Directive for field renaming
    """
    directive @${directiveName}(
      "Parent's field name"
      name: String!
    ) on FIELD_DEFINITION
    `,
    renameFromDirectiveTransformer: (schema: GraphQLSchema) =>
      mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName) => {
          const directive = getDirective(schema, fieldConfig, directiveName)?.[0];

          if (directive) {
            const { name } = directive as {name: string};

            const { resolve = defaultFieldResolver } = fieldConfig;

            fieldConfig.resolve = (parent, args, context, info) => {
              parent[fieldName] = parent[name];

              return resolve(parent, args, context, info);
            };
          }

          return fieldConfig;
        },
      }),
  };
};

export default renameFromDirective;
