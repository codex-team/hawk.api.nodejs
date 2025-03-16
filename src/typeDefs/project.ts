import { gql } from 'apollo-server-express';

export default gql`

"""
Possible events order
"""
enum EventsSortOrder {
  BY_DATE
  BY_COUNT
  BY_AFFECTED_USERS
}

"""
Events filters input type
"""
input EventsFiltersInput {
  """
  If True, includes events with resolved mark to the output
  """
  resolved: Boolean
  """
  If True, includes events with starred mark to the output
  """
  starred: Boolean
  """
  If True, includes events with ignored mark to the output
  """
  ignored: Boolean
}

"""
Respose object with updated project and his id
"""
type UpdateProjectResponse {
  """
  Project id
  """
  recordId: ID!

  """
  Modified project
  """
  record: Project!
}

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
  Date of creating project
  """
  creationDate: DateTime!

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
  event(id: ID!): Event

  """
  Project events
  """
  events(
    "Maximum number of results"
    limit: Int = 50

    "Certain number of documents to skip"
    skip: Int = 0
  ): [Event!]

  """
  Returns recent events grouped by day
  """
  recentEvents(
    "Maximum number of results"
    limit: Int! = 50

    "Certain number of documents to skip"
    skip: Int! = 0

    "Events sort order"
    sort: EventsSortOrder = lastRepetitionTime

    "Event marks by which events should be sorted"
    filters: EventsFiltersInput

    "Search query"
    search: String
  ): RecentEvents
  """
  Return events that occurred after a certain timestamp
  """
  chartData(
    """
    How many days we need to fetch for displaying in a chart
    """
    days: Int! = 0

    """
    User's local timezone offset in minutes
    """
    timezoneOffset: Int! = 0
  ): [ChartDataItem]
  """
  Returns number of unread events
  """
  unreadCount: Int!

  """
  Project notification settings
  """
  notifications: [ProjectNotificationsRule]
}

extend type Query {
  """
  Returns project info
  """
  project("Project id" projectId: ID!): Project @requireUserInWorkspace
}

extend type Mutation {
  """
  Create project in given workspace
  """
  createProject(
    """
    Workspace ID
    """
    workspaceId: ID!
    """
    Project name
    """
    name: String! @validate(notEmpty: true)

    """
    Project image
    """
    image: Upload @uploadImage
  ): Project! @requireAdmin

  """
  Update project settings
  """
  updateProject(
    """
    What project to update
    """
    id: ID!

    """
    Project name
    """
    name: String! @validate(notEmpty: true)

    """
    Project description
    """
    description: String

    """
    Project image
    """
    image: Upload @uploadImage
  ): Project! @requireAdmin

  """
  Generates new project integration token by id
  """
  generateNewIntegrationToken(
    """
    What project to regenerate integration token
    """
    id: ID!
  ): UpdateProjectResponse! @requireAdmin

  """
  Remove project
  """
  removeProject(
    "What project to remove"
    projectId: ID!
  ): Boolean! @requireAdmin

  """
  Updates user's visit time on project
  """
  updateLastProjectVisit(
    """
    project ID
    """
    projectId: ID!
  ): DateTime! @requireUserInWorkspace
}

input EventsFilter {
  """
  Search query string. Only alphanumeric characters, spaces, and some special characters are allowed.
  Max length: 50 characters
  """
  search: String
}
`;
