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
    Workspace id which plan changed
    """
    recordId: ID

    """
    Workspace which plan changed
    """
    record: Workspace!
  }

  extend type Mutation {
    """
    Mutation in order to switch workspace tariff plan to Free
    Returns updated workspace
    """
    changeWorkspacePlanForFreePlan(
        input: ChangeWorkspacePlanInput
    ): ChangeWorkspacePlanResponse! @requireAdmin
  }
`;
