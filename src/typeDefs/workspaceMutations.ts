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
    Modified workspace id
    """
    recordId: ID
    """
    Modified workspace object
    """
    record: Workspace
  }

  extend type Mutation {
    """
    Mutation in order to switch workspace tariff plan
    Returns true if operation is successful
    """
    changeWorkspacePlan(
        input: ChangeWorkspacePlanInput
    ): ChangeWorkspacePlanResponse! @requireAdmin
  }
`;
