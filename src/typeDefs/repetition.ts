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
Release data of the corresponding event
"""
type Release {
  """
  Release name
  """
  releaseName: String! @renameFrom(name: "release")

  """
  Release commits
  """
  commits: [Commit!]!
}

"""
Event backtrace representation
"""
type RepetitionBacktraceFrame {
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
Repetition user representation
"""
type RepetitionUser {
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
Type representing Repetition payload
"""
type RepetitionPayload {
  """
  Event title
  """
  title: String!

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
  backtrace: [RepetitionBacktraceFrame]

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
  user: RepetitionUser

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
Possible repetition marks
"""
enum RepetitionMark {
  resolved
  starred
  ignored
}

"""
Object returned in marks property of repetition object
"""
type RepetitionMarks {
  resolved: Boolean!
  starred: Boolean!
  ignored: Boolean!
}

"""
Type representing Hawk single Repetition
"""
type Repetition {
  """
  Repetition id
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
  payload: RepetitionPayload!

  """
  Event timestamp
  """
  timestamp: Float!

  """
  Event first appearance timestamp
  """
  firstAppearanceTimestamp: Float!

  """
  Release data
  """
  release: Release

  """
  Array of users who visited repetition
  """
  visitedBy: [User!]

  """
  Repetition label for current user
  """
  marks: RepetitionMarks! @default(value: "{}")

  """
  Repetition's repetitions
  """
  repetitions: [Repetition!]

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
  repetitionOccurred: Repetition! @requireAuth
}
  
"""
Event information per day with these events
"""
type RecentEvents {
  """
  Occured events list
  """
  events: [Repetition!]

  """
  Information about occurred events per day
  """
  dailyInfo: [DailyEventInfo]
}

input UpdateAssigneeInput {
  """
  ID of project repetition is related to
  """
  projectId: ID!

  """
  ID of the selected repetition
  """
  repetitionId: ID!

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
  ID of the selected repetition
  """
  repetitionId: ID!
}

type RemoveAssigneeResponse {
  """
  Response status
  """
  success: Boolean!
}

type RepetitionMutations {
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
  Mutation marks repetition as visited for current user
  """
  visitRepetition(
    project: ID!
    id: ID!
  ): Boolean! @requireAuth

  """
  Mutation sets or unsets passed mark to repetition
  """
  toggleRepetitionMark(
    """
    ID of project event is related to
    """
    project: ID!

    """
    Repetition ID to set the mark
    """
    repetitionId: ID!

    """
    Mark to set
    """
    mark: RepetitionMark!
  ): Boolean! @requireAuth

  """
  Namespace that contains only mutations related to the repetitions
  """
  repetitions: RepetitionMutations!
}
`;
