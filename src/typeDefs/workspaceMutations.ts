import { gql } from 'apollo-server-express';

export default gql`
  """
  Payload for changing workspace tariff plan
  """
  input ChangeWorkspacePlanInput {
    """
    Workspace ID
    """
    workspaceId: ID!

    """
    Tariff plan ID
    """
    planId: ID!
  }

  """
  Workspace tariff plan change mutation response
  """
  type ChangeWorkspacePlanResponse {
    """
    Business operation id
    """
    recordId: ID

    """
    Modified workspace object
    """
    record: BusinessOperation

    """
    Workspace balance
    """
    balance: Long!
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
    Mutation in order to switch workspace tariff plan
    Returns true if operation is successful
    """
    changeWorkspacePlan(
        input: ChangeWorkspacePlanInput
    ): ChangeWorkspacePlanResponse! @requireAdmin

    """
    Namespace for workspaces mutations
    """
    workspace: WorkspaceMutations!
  }
`;
