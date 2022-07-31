import { GraphQLScalarType } from 'graphql';

/**
 * Custom GraphQL Scalar type
 * Represents JSON objects encoded (or not) in string format
 */
const GraphQLEncodedJSON = new GraphQLScalarType({
  name: 'EncodedJSON',
  description: 'Represents JSON objects encoded (or not) in string format',
  serialize(value): object {
    if (typeof value === 'string') {
      return JSON.parse(value);
    } else if (typeof value === 'object') {
      return value || {}
    }

    throw new Error('EncodedJSON cannot represent non-string or non-object values');
  },
});

export default GraphQLEncodedJSON;
