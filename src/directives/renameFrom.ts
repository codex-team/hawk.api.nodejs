import { defaultFieldResolver, GraphQLSchema } from 'graphql';
import { mapSchema, MapperKind, getDirective } from '@graphql-tools/utils';

/**
 * RenameFrom directive function return type
 */
interface RenameFromDirectiveResult {
  /**
   * Type definition for directive
   */
  renameFromDirectiveTypeDefs: string;

  /**
   * Schema transformer for applying directive
   *
   * @param schema - schema to transform
   */
  renameFromDirectiveTransformer: (schema: GraphQLSchema) => GraphQLSchema
}

/**
 * Directive for renaming parent fields
 *
 * @param directiveName - directive name in the schema
 */
export default function renameFromDirective(directiveName = 'renameFrom'): RenameFromDirectiveResult {
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
}
