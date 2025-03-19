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

  """
  File size in bytes
  """
  size: Int!
}

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
Release data
"""
type Release {
  """
  Release ID
  """
  id: ID! @renameFrom(name: "_id")

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
`;