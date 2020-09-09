import { GraphQLScalarType } from 'graphql';

/**
 * Custom GraphQL Scalar type
 * Represents JSON objects encoded (or not) in string format
 */
const GraphQLEncodedJSON = new GraphQLScalarType({
  name: 'EncodedJSON',
  description: 'Represents JSON objects encoded (or not) in string format',
  serialize(value: string | object): object {
    if (typeof value === 'string') {
      return JSON.parse(value);
    }

    return value;
  },
});

export default GraphQLEncodedJSON;
