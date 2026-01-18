import { gql } from 'apollo-server-express';

export default gql`
  """
  Input type for updating task manager settings
  """
  input UpdateTaskManagerSettingsInput {
    """
    Project ID to update
    """
    projectId: ID!

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
  }

  extend type Mutation {
    """
    Disconnect Task Manager integration from project
    """
    disconnectTaskManager(
      """
      Project ID to disconnect Task Manager from
      """
      projectId: ID!
    ): Project! @requireAdmin

    """
    Update Task Manager settings for project
    """
    updateTaskManagerSettings(
      """
      Task Manager settings input
      """
      input: UpdateTaskManagerSettingsInput!
    ): Project! @requireAdmin
  }
`;
