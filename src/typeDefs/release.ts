import { gql } from 'apollo-server-express';

export default gql`
  """
  Source map file details
  """
  type SourceMapData {
    """
    Source map filename
    """
    mapFileName: String!

    """
    Original source filename
    """
    originFileName: String!
  }

  """
  Release data
  """
  type Release {
    """
    Release ID
    """
    _id: ID!

    """
    Release name
    """
    release: String!

    """
    Project ID associated with the release
    """
    projectId: ID!

    """
    Release commits
    """
    commits: [Commit!]

    """
    Source maps associated with the release
    """
    files: [SourceMapData!]!
  }

  extend type Query {
    """
    Fetch list of releases.
    If projectId is provided, fetch releases for the given project.
    """
    getReleases(projectId: ID!): [Release]!
  }
`;
