import { gql } from 'apollo-server-core';

const rootSchema = gql`
  """
  API queries
  """
  type Query {
    """
    Healthcheck endpoint
    """
    health: String!
  }

  """
  API mutations
  """
  type Mutation {
    """
    Unused field to let extend this type
    """
    _: Boolean
  }
`;

const typeDefinitions = [
  rootSchema,
];

export default typeDefinitions;
