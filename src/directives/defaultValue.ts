import { defaultFieldResolver, GraphQLSchema } from 'graphql';
import { mapSchema, MapperKind, getDirective } from '@graphql-tools/utils';
import { UnknownGraphQLResolverResult } from '../types/graphql';

export default function defaultValueDirective(directiveName = 'default') {
  return {
    defaultValueDirectiveTypeDefs: `
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
        [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName) => {
          const defaultValueDirective = getDirective(schema, fieldConfig, directiveName)?.[0];

          if (defaultValueDirective) {
            let { value } = defaultValueDirective as {value: string};

            try {
              value = JSON.parse(value);
            } catch (_) {
              console.warn('Value for @default directive should be JSON string.');
            }

            const { resolve = defaultFieldResolver } = fieldConfig;

            fieldConfig.resolve = async (object, args, context, info): UnknownGraphQLResolverResult => {
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
