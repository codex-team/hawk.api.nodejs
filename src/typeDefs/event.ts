import { gql } from 'apollo-server-express';

export default gql`
"""
Source code line representation
"""
type SourceCodeLine {
  """
  Line number
  """
  line: Int

  """
  Line's content
  """
  content: String
}

"""
Event backtrace representation
"""
type EventBacktraceFrame {
  """
  Source filepath
  """
  file: String

  """
  Called line
  """
  line: Int

  """
  Called column
  """
  column: Int

  """
  Part of source code file near the called line
  """
  sourceCode: [SourceCodeLine]

  """
  Function name extracted from current stack frame
  """
  function: String

  """
  Function arguments extracted from current stack frame
  """
  arguments: [String]
}

"""
Event user representation
"""
type EventUser {
  """
  Internal user's identifier inside an app
  """
  id: ID

  """
  User public name
  """
  name: String

  """
  URL for user's details page
  """
  url: String

  """
  User's public picture
  """
  photo: String
}

"""
Type representing Event payload
"""
type EventPayload {
  """
  Event title
  """
  title: String!

  """
  Event type: TypeError, ReferenceError etc.
  """
  type: String

  """
  Event timestamp
  """
  timestamp: Float!

  """
  Event severity level
  """
  level: Int

  """
  Event stack array from the latest call to the earliest
  """
  backtrace: [EventBacktraceFrame]

  """
  Additional data about GET request
  """
  get: JSONObject

  """
  Additional data about POST request
  """
  post: JSONObject

  """
  HTTP headers
  """
  headers: JSONObject

  """
  Source code version identifier
  """
  release: String

  """
  Current authenticated user
  """
  user: EventUser

  """
  Any additional data of Event
  """
  context: EncodedJSON

  """
  Custom data provided by project users
  """
  addons: EncodedJSON
}

"""
Type representing Event payload. All fields can be omitted if there are no difference with the original
"""
type RepetitionPayload {
  """
  Event timestamp. Can be empty if repetition has the same timestamp as original event
  """
  timestamp: Float

  """
  Event title
  """
  title: String

  """
  Event type: TypeError, ReferenceError etc.
  """
  type: String

  """
  Event severity level
  """
  level: Int

  """
  Event stack array from the latest call to the earliest
  """
  backtrace: [EventBacktraceFrame!]

  """
  Additional data about GET request
  """
  get: JSONObject

  """
  Additional data about POST request
  """
  post: JSONObject

  """
  HTTP headers
  """
  headers: JSONObject

  """
  Source code version identifier
  """
  release: String

  """
  Current authenticated user
  """
  user: EventUser

  """
  Any additional data of Event
  """
  context: EncodedJSON

  """
  Custom data provided by project users
  """
  addons: EncodedJSON
}

"""
Event's repetitions. Make Event unique by repetition's payload
"""
type Repetition {
  """
  Standalone repetition ID
  """
  id: ID! @renameFrom(name: "_id")

  """
  Event's hash
  """
  groupHash: String!

  """
  Event's payload patch
  """
  payload: RepetitionPayload!
}

"""
Possible event marks
"""
enum EventMark {
  resolved
  starred
  ignored
}

"""
Object returned in marks property of event object
"""
type EventMarks {
  resolved: Boolean!
  starred: Boolean!
  ignored: Boolean!
}

"""
Type representing Hawk single Event
"""
type Event {
  """
  Event id
  """
  id: ID! @renameFrom(name: "_id")

  """
  Catcher type
  """
  catcherType: String!

  """
  Event group hash
  """
  groupHash: String!

  """
  Event occurrence count
  """
  totalCount: Int!

  """
  User assigneed to the event
  """
  assignee: User

  """
  Event payload
  """
  payload: EventPayload!

  """
  Release data
  """
  release: Release

  """
  Event concrete repetition
  """
  repetition(id: ID): Repetition

  """
  Event repetitions
  """
  repetitions(skip: Int = 0, limit: Int = 10): [Repetition!]

  """
  Array of users who visited event
  """
  visitedBy: [User!]

  """
  Event label for current user
  """
  marks: EventMarks! @default(value: "{}")

  """
  How many users catch this error
  """
  usersAffected: Int

  """
  Return graph of the error rate for the last few days
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
  ): [ChartDataItem!]! @requireAuth
}

"""
Information about event per day
"""
type DailyEventInfo {
  """
  Event hash for grouping
  """
  groupHash: String!

  """
  Event occurrence count
  """
  count: Int!

  """
  Event occurrence datetime (in unixtime)
  """
  groupingTimestamp: Float!

  """
  Event's last repetition ID
  """
  lastRepetitionId: ID

  """
  Last event occurrence timestamp
  """
  lastRepetitionTime: Float!

  """
  How many users catch this error per day
  """
  affectedUsers: Int
}

type Subscription {
  """
  Sends new events from all user projects
  """
  eventOccurred: Event! @requireAuth
}
  
"""
Event information per day with these events
"""
type RecentEvents {
  """
  Occured events list
  """
  events: [Event!]

  """
  Information about occurred events per day
  """
  dailyInfo: [DailyEventInfo]
}

input UpdateAssigneeInput {
  """
  ID of project event is related to
  """
  projectId: ID!

  """
  ID of the selected event
  """
  eventId: ID!

  """
  Assignee id to set
  """
  assignee: ID!
}

type UpdateAssigneeResponse {
  """
  Response status
  """
  success: Boolean!

  """
  User assigned to the event
  """
  record: User!
}

input RemoveAssigneeInput {
  """
  ID of project event is related to
  """
  projectId: ID!

  """
  ID of the selected event
  """
  eventId: ID!
}

type RemoveAssigneeResponse {
  """
  Response status
  """
  success: Boolean!
}

type EventsMutations {
  """
  Set an assignee for the selected event
  """
  updateAssignee(
    input: UpdateAssigneeInput!
  ): UpdateAssigneeResponse! @requireAuth @requireUserInWorkspace

  """
  Remove an assignee from the selected event
  """
  removeAssignee(
    input: RemoveAssigneeInput!
  ): RemoveAssigneeResponse! @requireAuth @requireUserInWorkspace
}

extend type Mutation {
  """
  Mutation marks event as visited for current user
  """
  visitEvent(
    project: ID!
    id: ID!
  ): Boolean! @requireAuth

  """
  Mutation sets or unsets passed mark to event
  """
  toggleEventMark(
    """
    ID of project event is related to
    """
    project: ID!

    """
    EvenID of the event to set the mark
    """
    eventId: ID!

    """
    Mark to set
    """
    mark: EventMark!
  ): Boolean! @requireAuth

  """
  Namespace that contains only mutations related to the events
  """
  events: EventsMutations!
}
`;
