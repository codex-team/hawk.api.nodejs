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
Pagination cursor of events portion and list of daily events
"""
type DailyEventsPortion {
  """
  Pointer to the next portion of dailyEvents, null if there are no events left
  """
  nextCursor: DailyEventsCursor

  """
  List of daily events
  """
  dailyEvents: [DailyEvent]
}

"""
Daily event information with event itself
"""
type DailyEvent {
  """
  ID of the daily event
  """
  id: ID!
  """
  Count of events in this day
  """
  count: Int!
  """
  Count of the users affected by this event in this day
  """
  affectedUsers: Int!
  """
  Timestamp of the event grouping
  """
  groupingTimestamp: Int!
  """
  Last repetition of the day that represents all of the repetition this day
  """
  event: Event!
}

"""
Cursor for fetching daily events portion
"""
type DailyEventsCursor {
  """
  Grouping timestamp of the first event in the next portion
  """
  groupingTimestampBoundary: Int!

  """
  Sort key value of the first event in the next portion
  """
  sortValueBoundary: Int!

  """
  ID of the first event of in the next portion
  """
  idBoundary: ID!
}

input DailyEventsCursorInput {
  groupingTimestampBoundary: Int!
  sortValueBoundary: Int!
  idBoundary: ID!
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
  event(eventId: ID!, originalEventId: ID!): Event

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
  Portion of daily events
  """
  dailyEventsPortion(
    """
    Maximum number of results
    """
    limit: Int! = 50

    """
    Pointer to the first event of the portion that would be fetched
    """
    nextCursor: DailyEventsCursorInput

    """
    Events sort order
    """
    sort: EventsSortOrder = lastRepetitionTime

    """
    Event marks by which events should be filtered
    """
    filters: EventsFiltersInput

    """
    Search query
    """
    search: String
  ): DailyEventsPortion

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
