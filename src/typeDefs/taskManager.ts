import { gql } from 'apollo-server-express';

export default gql`
  """
  Task Manager usage tracking for daily auto-task budget
  """
  type TaskManagerUsage {
    """
    UTC day boundary (e.g. 2026-01-17T00:00:00.000Z)
    """
    dayStartUtc: DateTime!

    """
    Number of auto-created tasks since dayStartUtc
    """
    autoTasksCreated: Int!
  }

  """
  GitHub Task Manager specific configuration
  """
  type GitHubTaskManagerConfig {
    """
    GitHub App installation ID
    """
    installationId: String!

    """
    Repository ID
    """
    repoId: String!

    """
    Repository full name (owner/repo)
    """
    repoFullName: String!
  }

  """
  Task Manager configuration for project
  """
  type TaskManager {
    """
    Type of task manager (currently only 'github' is supported)
    """
    type: String!

    """
    Enable automatic task creation by scheduled worker
    """
    autoTaskEnabled: Boolean!

    """
    Threshold for auto task creation (minimum totalCount)
    """
    taskThresholdTotalCount: Int!

    """
    Assign agent (e.g. Copilot) to newly created tasks
    """
    assignAgent: Boolean!

    """
    Usage tracking for daily auto-task budget
    """
    usage: TaskManagerUsage

    """
    Date when integration was connected
    """
    connectedAt: DateTime!

    """
    Date when configuration was last updated
    """
    updatedAt: DateTime!

    """
    Task manager specific configuration (typed by type)
    """
    config: GitHubTaskManagerConfig!
  }
`;
