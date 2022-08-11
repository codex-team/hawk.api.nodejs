import { gql } from 'apollo-server-core';

const workspaceTypedefs =  gql`
  """
  Response of updated workspace mutations
  """
  type UpdateWorkspaceResponse {
    """
    Id of updated workspace
    """
    recordId: ID!

    """
    Updated workspace object
    """
    record: Workspace!
  }

  """
  Confirmed member data in workspace
  """
  type ConfirmedMember {
    """
    Member info id
    """
    id: ID! @renameFrom(name: "_id")

    """
    If member accepts an invitation, the user id will be stored there
    """
    user: User!

    """
    True if user has admin permissions
    """
    isAdmin: Boolean!
  }

  """
  Pending member data in workspace
  """
  type PendingMember {
    """
    Member info id
    """
    id: ID! @renameFrom(name: "_id")

    """
    Email to which the invitation was sent
    """
    email: String! @renameFrom(name: "userEmail")
  }

  """
  Represents two types of Members in workspace's team
  """
  union Member = ConfirmedMember | PendingMember

  """
  Represent Workspace info
  """
  type Workspace {
    """
    Workspace id
    """
    id: ID! @renameFrom(name: "_id")

    """
    Workspace name
    """
    name: String

    """
    Workspace description
    """
    description: String

    """
    Date of creating workspace
    """
    creationDate: DateTime!

    """
    Workspace logo image
    """
    image: String

    """
    Workspace team info
    """
    team: [Member!]!

    """
    Invite hash for joining in workspace via link
    """
    inviteHash: String!

    """
    Total number of errors since the last charge date
    """
    billingPeriodEventsCount: Int

#    """
#    Workspace tariff plan
#    """
#    plan: Plan

#    """
#    Workspace projects array
#    """
#    projects(
#      """
#      Project(s) id(s)
#      """
#      ids: [ID!] = []
#    ): [Project!] @requireAuth
  }

  extend type Query {
    """
    Returns workspace(s) info
    If ids = [] returns all user's workspaces
    """
    allWorkspaces: [Workspace] @requireAuth
  }
`;

export default workspaceTypedefs;
