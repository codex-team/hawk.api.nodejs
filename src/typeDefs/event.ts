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
  id: ID!

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
  context: JSONObject

  """
  Custom data provided by project users
  """
  addons: JSONObject
}

"""
Type representing Event payload
"""
type RepetitionPayload {
  """
  Event timestamp
  """
  timestamp: Float

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
  context: JSONObject

  """
  Custom data provided by project users
  """
  addons: JSONObject
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
  Assigner id
  """
  assigner: String

  """
  Event payload
  """
  payload: EventPayload!

  """
  Event concrete repetition
  """
  repetition(id: ID): Repetition

  """
  Event repetitions
  """
  repetitions(limit: Int = 10): [Repetition!]

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

extend type Mutation {
  """
  Mutation marks event as visited for current user
  """
  visitEvent(
    project: ID!,
    id: ID!
  ): Boolean! @requireAuth

  """
  Mutation sets or unsets passed mark to event
  """
  toggleEventMark(
    """
    ID of project event is related to
    """
    project: ID!,

    """
    EvenID of the event to set the mark
    """
    eventId: ID!,

    """
    Mark to set
    """
    mark: EventMark!
  ): Boolean! @requireAuth

  """
  Set assigner for selected event
  """
  setAssigner(
    """
    ID of project event is related to
    """
    project: ID!,

    """
    EvenID of the event to set the mark
    """
    eventId: ID!,

    """
    Assigner id to set
    """
    assigner: String!,
  ): Boolean! @requireAuth
}
`;
