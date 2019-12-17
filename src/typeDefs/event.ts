import { gql } from 'apollo-server-express';

export default gql`
"""
Source code line representation
"""
type SourceCodeLine {
  """
  Line number
  """
  line: Int!

  """
  Line's content
  """
  content: String
}

"""
Source code line representation for repetition
This type is defined because repetition diff might be empty
"""
type RepetitionSourceCodeLine {
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
  sourceCode: [SourceCodeLine!]
    
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
Event backtrace representation for repetition
backtrace for repetition can be different for repetition
"""
type RepetitionBacktrace {
  """
  Source filepath
  """
  file: String

  """
  Called line
  """
  line: Int

  """
  Part of source code file near the called line
  """
  sourceCode: [RepetitionSourceCodeLine!]
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
  backtrace: [RepetitionBacktrace!]

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
type Repetitions {
  """
  Standalone repetition ID
  """
  id: ID!

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
Type representing Hawk single Event
"""
type Event {
  """
  Event id
  """
  id: ID!

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
  Event's repetitions
  """
  repetitions(limit: Int = 10): [Repetitions!]
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
`;
