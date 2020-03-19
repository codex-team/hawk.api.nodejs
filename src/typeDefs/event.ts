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
  id: ID!
  name: String!
  url: String
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
  Event timestamp
  """
  timestamp: DateTime!

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
  timestamp: DateTime!

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
  STARRED
  IGNORED
  RESOLVED
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
  Array of ID of users who visited event
  """
  visitedBy: [ID!]

  """
  Event label for current user
  """
  marks: [EventMark]
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
  Event occurrence date
  """
  date: String!

  """
  Event's last repetition ID
  """
  lastRepetitionId: ID

  """
  Last event occurrence timestamp
  """
  timestamp: DateTime!
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
    project: ID!,
    id: ID!,
    mark: EventMark!
  ): Boolean! @requireAuth
}
`;
