import { graphql, GraphQLObjectType, GraphQLSchema } from 'graphql';
import GraphQLEncodedJSON from '../../src/resolvers/encodedJSON';

const FIXTURE = {
  string: 'string',
  int: 3,
  float: 3.14,
  true: true,
  false: false,
  null: null,
  object: {
    string: 'string',
    int: 3,
    float: 3.14,
    true: true,
    false: false,
    null: null,
  },
  array: ['string', 3, 3.14, true, false, null, 'string.with.dot'],
};

type RootType = typeof FIXTURE

/**
 * Creates schema for testing purposes
 * @returns GraphQLSchema
 */
function createSchema(): GraphQLSchema {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        rootValue: {
          type: GraphQLEncodedJSON,
          resolve: (obj): RootType => obj,
        },
      },
    }),
  });
}
describe('GraphQLEncodedJSON', () => {
  const schema = createSchema();

  describe('serialize', () => {
    it('should support serialization from object', async () => {
      const { data, errors } = await graphql({
        schema,
        source: `
           query {
            rootValue
          }
        `,
        rootValue: FIXTURE
      });

      expect(data?.rootValue).toEqual(FIXTURE);
      expect(errors).toBeUndefined();
    });

    it('should support serialization from string', async () => {
      const { data, errors } = await graphql({
        schema,
        source: `
          query {
            rootValue
          }
        `,
        rootValue: JSON.stringify(FIXTURE)
      });

      expect(data?.rootValue).toEqual(FIXTURE);
      expect(errors).toBeUndefined();
    });
  });
});
