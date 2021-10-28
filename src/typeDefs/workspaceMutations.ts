import { gql } from 'apollo-server-express';

export default gql`
  """
  Payload for changing workspace tariff plan
  """
  input changeWorkspacePlanToDefaultInput {
    """
    Workspace ID
    """
    workspaceId: ID!
  }

  """
  Workspace tariff plan change mutation response
  """
  type changeWorkspacePlanToDefaultResponse {
    """
    Workspace id which plan changed
    """
    recordId: ID

    """
    Workspace which plan changed
    """
    record: Workspace!
  }

  """
  Input data for cancelSubscription mutation
  """
  input CancelSubscriptionInput {
    """
    Workspace id to cancel subscription for
    """
    workspaceId: ID!
  }

  """
  Respose of the cancelSubscription mutation
  """
  type CancelSubscriptionResponse {
    """
    Workspace id
    """
    recordId: ID!

    """
    Modified workspace
    """
    record: Workspace!
  }

  """
  Mutations for workspace
  """
  type WorkspaceMutations {
    cancelSubscription(
      input: CancelSubscriptionInput!
    ): CancelSubscriptionResponse! @requireAdmin
  }

  extend type Mutation {
    """
    Mutation in order to switch workspace tariff plan to default
    Returns updated workspace
    """
    changeWorkspacePlanToDefault(
        input: changeWorkspacePlanToDefaultInput
    ): changeWorkspacePlanToDefaultResponse! @requireAdmin

    """
    Namespace for workspaces mutations
    """
    workspace: WorkspaceMutations!
  }
`;
