import { gql } from 'apollo-server-express';

export default gql`
  """
  Input type for creating new event grouping pattern
  """
  input CreateProjectEventGroupingPatternInput {
    """
    Pattern string
    """
    pattern: String!

    """
    Id of the project
    """
    projectId: ID!
  }

  """
  Input type for updating of the event grouping pattern
  """
  input UpdateProjectEventGroupingPatternInput {
    """
    Id of the pattern to be updated
    """
    id: ID!

    """
    New pattern string
    """
    pattern: String!

    """
    Id of the project
    """
    projectId: ID!
  }

  """
  Input type for deleting of the event grouping pattern
  """
  input RemoveProjectEventGroupingPatternInput {
    """
    Id of the pattern to be removed
    """
    id: ID!

    """
    Id of the project
    """
    projectId: ID!
  }

  extend type Mutation {
    """
    Creates new event grouping pattern
    """
    createProjectEventGroupingPattern(
      "Data for creating"
      input: CreateProjectEventGroupingPatternInput!
    ): ProjectEventGroupingPattern @requireAdmin

    """
    Updates existing event grouping pattern
    """
    updateProjectEventGroupingPattern(
      "Data for updating"
      input: UpdateProjectEventGroupingPatternInput!
    ): ProjectEventGroupingPattern @requireAdmin

    """
    Removes notifications rule from project
    """
    removeProjectEventGroupingPattern(
      "Data for deleting"
      input: RemoveProjectEventGroupingPatternInput!
    ): ProjectEventGroupingPattern @requireAdmin
  }
`;
