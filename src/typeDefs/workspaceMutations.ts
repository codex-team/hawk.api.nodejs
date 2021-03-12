import { gql } from 'apollo-server-express';

export default gql`
  """
  Payload for changing workspace tariff plan
  """
  input ChangeWorkspacePlanForFreePlanInput {
    """
    Workspace ID
    """
    workspaceId: ID!
  }

  """
  Workspace tariff plan change mutation response
  """
  type ChangeWorkspacePlanForFreePlanResponse {
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
        input: ChangeWorkspacePlanForFreePlanInput
    ): ChangeWorkspacePlanForFreePlanResponse! @requireAdmin
  }
`;
