import { gql } from 'apollo-server-express';

export default gql`
"""
Project representation
"""
type Project {
  """
  Project ID
  """
  id: ID!

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
  event(
      """
      Event ID
      """
      id: ID!

      """
      Event's concrete repetition ID
      """
      repetitionId: ID
  ): Event @requireAuth

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
  Get project personal notification settings
  """
  personalNotificationsSettings: NotifySettings! @requireAuth

  """
  Get project common notification settings
  """
  commonNotificationsSettings: NotifySettings! @requireAuth
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
