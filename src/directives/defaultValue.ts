import { defaultFieldResolver, GraphQLSchema } from 'graphql';
import { mapSchema, MapperKind, getDirective } from '@graphql-tools/utils';

/**
 * DefaultValue directive function return type
 */
interface DefaultValueDirectiveResult {
  /**
   * Type definition for directive
   */
  defaultValueDirectiveTypeDefs: string;

  /**
   * Schema transformer for applying directive
   *
   * @param schema - schema to transform
   */
  defaultValueDirectiveTransformer: (schema: GraphQLSchema) => GraphQLSchema
}

/**
 * Directive function for applying default value
 *
 * @param directiveName - directive name in the schema
 */
export default function defaultValueDirective(directiveName = 'default'): DefaultValueDirectiveResult {
  return {
    defaultValueDirectiveTypeDefs:`
    """
    Directive for setting field default value
    """
    directive @${directiveName}(
      "Default field value encoded in JSON"
      value: String!
    ) on FIELD_DEFINITION
    `,
    defaultValueDirectiveTransformer: (schema: GraphQLSchema) =>
      mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
          const directive = getDirective(schema, fieldConfig, directiveName)?.[0];

          if (directive) {
            let { value } = directive as {value: string};

            try {
              value = JSON.parse(value);
            } catch (_) {
              console.warn('Value for @default directive should be JSON string.');
            }

            const { resolve = defaultFieldResolver } = fieldConfig;

            fieldConfig.resolve = async (object, args, context, info) => {
              let result = await resolve(object, args, context, info);

              if (value && !result) {
                result = value;
              }

              return result;
            };
          }

          return fieldConfig;
        },
      }),
  };
}
