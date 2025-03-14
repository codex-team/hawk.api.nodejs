import { gql } from 'apollo-server-express';

export default gql`
  """
  Release commit
  """
  type Commit {
    """
    Hash of the commit
    """
    hash: String!

    """
    Commit author
    """
    author: String!

    """
    Commit title
    """
    title: String!

    """
    Commit creation date
    """
    date: DateTime!
  }

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
    Release name
    """
    releaseName: String! @renameFrom(name: "release")

    """
    Project ID associated with the release
    """
    projectId: ID!

    """
    Release commits
    """
    commits: [Commit!]!

    """
    Source maps associated with the release
    """
    files: [SourceMapData!]!
  }

  """
  Queries related to releases
  """
  extend type Query {
    """
    Fetch list of releases.
    If projectId is provided, fetch releases for the given project.
    """
    getReleases(projectId: ID): [Release]!
  }
`;
