import { gql } from 'apollo-server-express';

export default gql`
  """
  Project event grouping settings
  """
  type ProjectEventGroupingPattern {
    """
    id of the event grouping pattern
    """
    id: ID! @renameFrom(name: "_id")

    """
    event grouping pattern string
    """
    pattern: String!
  }

  type ProjectEventGroupingPatternContent {
    """
    event grouping pattern string
    """
    pattern: String!
  }

  type ProjectEventGroupingPatternPointer {
    """
    id of the event grouping pattern
    """
    id: ID! @renameFrom(name: "_id")
  }
`;
