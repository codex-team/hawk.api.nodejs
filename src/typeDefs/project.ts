import { gql } from 'apollo-server-express';

export default gql`
"""
Project representation
"""
type Project {
  """
  Project ID
  """
  id: ID! @renameFrom(name: "_id")

  """
  Project token
  """
  token: String!

  """
  Project name
  """
  name: String!

  """
  Project description
  """
  description: String

  """
  Project domain
  """
  domain: String

  """
  Project URI
  """
  uri: String

  """
  Project image
  """
  image: String

  """
  User who created project
  """
  uidAdded: User!

  """
  Project's Event
  """
  event(id: ID!): Event @requireAuth

  """
  Project events
  """
  events(
    "Maximum number of results"
    limit: Int = 50

    "Certain number of documents to skip"
    skip: Int = 0
  ): [Event!] @requireAuth

  """
  Returns recent events grouped by day
  """
  recentEvents(
    "Maximum number of results"
    limit: Int! = 50

    "Certain number of documents to skip"
    skip: Int! = 0
  ): RecentEvents @requireAuth

  """
  Returns number of unread events
  """
  unreadCount: Int! @requireAuth

  """
  Project notification settings
  """
  notifications: [ProjectNotificationsRule] @requireAuth
}

extend type Query {
  """
  Returns project info
  """
  project("Project id" id: ID!): Project @requireAuth
}

extend type Mutation {
  """
  Create project in given workspace
  """
  createProject(
    "Workspace ID"
    workspaceId: ID!
    "Project name"
    name: String!

    "Project image"
    image: Upload @uploadImage
  ): Project! @requireAdmin

  """
  Update project settings
  """
  updateProject(
    "What project to update"
    id: ID!

    "Project name"
    name: String! @validate(notEmpty: true)

    "Project description"
    description: String

    "Project image"
    image: Upload @uploadImage
  ): Project! @requireAuth

  """
  Updates user's visit time on project
  """
  updateLastProjectVisit(
    "project ID"
    projectId: ID!
  ): DateTime! @requireAuth
}
`;
