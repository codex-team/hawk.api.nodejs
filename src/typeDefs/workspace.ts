import { gql } from 'apollo-server-express';

export default gql`
  type Member {
    """
    User's id
    """
    id: ID

    """
    User's email
    """
    email: String

    """
    User's name
    """
    name: String

    """
    User's image
    """
    image: String

    """
    True is user has admin permissions
    """
    isAdmin: Boolean

    """
    True if user invitation should be confirmed
    """
    isPending: Boolean
  }

  """
  Workspace tariff plan
  """
  type Plan {
    """
    Plan name
    """
    name: String

    """
    Subscription date
    """
    subscriptionDate: DateTime

    """
    Lsat charge date
    """
    lastChargeDate: DateTime

    """
    Monthly charge for plan
    """
    monthlyCharge: Int

    """
    Events limit for plan
    """
    eventsLimit: Int
  }

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
    Workspace logo image
    """
    image: String

    """
    Workspace users array
    """
    users: [Member!]

    """
    Workspace pending users array
    """
    pendingUsers: [Member!]

    """
    Workspace balance
    """
    balance: Int

    """
    Workspace tariff plan
    """
    plan: Plan

    """
    Workspace projects array
    """
    projects("Project(s) id(s)" ids: [ID!] = []): [Project!] @requireAuth
  }

  extend type Query {
    """
    Returns workspace(s) info
    If ids = [] returns all user's workspaces
    """
    workspaces("Workspace(s) id(s)" ids: [ID] = []): [Workspace] @requireAuth
  }

  extend type Mutation {
    """
    Create new workspace
    """
    createWorkspace(
      "New workspace name"
      name: String!

      "New workspace description"
      description: String

      "New workspace image"
      image: Upload @uploadImage
    ): Workspace! @requireAuth

    """
    Invite user to workspace
    Returns true if operation is successful
    """
    inviteToWorkspace(
      "Email of the user to invite"
      userEmail: String!

      "id of the workspace to which the user is invited"
      workspaceId: ID!
    ): Boolean! @requireAuth

    """
    Update workspace settings
    """
    updateWorkspace(
      "What workspace to update"
      id: ID!

      "Workspace name"
      name: String!

      "Workspace description"
      description: String

      "Workspace image"
      image: Upload @uploadImage
    ): Boolean! @requireAuth

    """
    Confirm invitation to workspace
    Returns true if operation is successful
    """
    confirmInvitation(
      "Hash from invitation link"
      inviteHash: String

      "Id of the workspace to which the user was invited"
      workspaceId: ID!
    ): Boolean! @requireAuth

    """
    Grant admin permissions
    Returns true if operation is successful
    """
    grantAdmin(
      """
      Workspace ID
      """
      workspaceId: ID!

      """
      ID of user to grant permissions
      """
      userId: ID!

      """
      Permissions state (true to grant, false to withdraw)
      """
      state: Boolean = true
    ): Boolean! @requireAuth

    """
    Remove member from workspace
    Returns true if operation is successful
    """
    removeMemberFromWorkspace(
      """
      Workspace ID
      """
      workspaceId: ID!

      """
      ID of user to remove
      """
      userId: ID

      """
      Email of user to remove
      """
      userEmail: String!
    ): Boolean! @requireAuth
  }
`;
