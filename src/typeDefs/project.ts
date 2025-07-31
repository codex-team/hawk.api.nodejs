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
  Filter events by marks (e.g. starred, resolved, ignored).
  Set to true to include only events that have the mark, or false to exclude those.
  Example: { starred: true, ignored: false }
  """
  marks: MarksFilterInput

  """
  Include only events that occurred after this date (inclusive).
  Accepts ISO date string or Unix timestamp (in seconds).
  """
  dateFrom: Timestamp

  """
  Include only events that occurred before this date (inclusive).
  Accepts ISO date string or Unix timestamp (in seconds).
  """
  dateTo: Timestamp
}

"""
Allows filtering by specific event marks.
Each field corresponds to event.marks.{name}.
"""
input MarksFilterInput {
  starred: Boolean
  resolved: Boolean
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

    """
    Filters for narrowing down the event results:
    - By marks (e.g., starred, resolved)
    - By date range (dateFrom / dateTo)
    """
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

  """
  Event grouping patterns
  """
  eventGroupingPatterns: [ProjectEventGroupingPattern]
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
  Max length: 100 characters
  """
  search: String
}
`;
