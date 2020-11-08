import { gql } from 'apollo-server-express';

export default gql`
  """
  Hawk tariff plan description
  """
  type Plan {
    """
    Plan id in MongoDB
    """
    id: ID! @renameFrom(name: "_id")

    """
    Plan name
    """
    name: String!

    """
    Monthly charge for plan
    """
    monthlyCharge: Long!

    """
    Events limit for plan
    """
    eventsLimit: Int!

    """
    True if plan is default one
    """
    isDefault: Boolean!
  }

  extend type Query {
    """
    Gets available Hawk tariff plans
    """
    plans: [Plan!]!
  }
`;
