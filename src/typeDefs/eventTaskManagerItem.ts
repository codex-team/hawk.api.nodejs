import { gql } from 'apollo-server-express';

export default gql`
"""
Task Manager item linked to an event (e.g., GitHub Issue)
"""
type TaskManagerItem {
  """
  Type of task manager item (currently only 'github-issue' is supported)
  """
  type: String!

  """
  Task number (e.g., GitHub Issue number)
  """
  number: Int!

  """
  URL to the task (e.g., GitHub Issue URL)
  """
  url: String!

  """
  Task title
  """
  title: String!

  """
  How the task was created (automatically by worker or manually by user)
  """
  createdBy: String!

  """
  Task creation timestamp
  """
  createdAt: DateTime!

  """
  Agent assigned to the task (e.g., 'copilot' for GitHub Copilot)
  """
  assignee: String
}
`;
