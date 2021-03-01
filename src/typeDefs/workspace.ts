import { gql } from 'apollo-server-express';

export default gql`
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
    Workspace logo image
    """
    image: String

    """
    Workspace team info
    """
    team: [Member!]!

    """
    Total number of errors since the last charge date
    """
    billingPeriodEventsCount: Int

    """
    Workspace tariff plan
    """
    plan: Plan

    """
    Date when workspace was charged last time
    """
    lastChargeDate: DateTime

    """
    ID of subscription if it subscribed
    Returns from CloudPayments
    """
    subscriptionId: String

    """
    Workspace projects array
    """
    projects(
      """
      Project(s) id(s)
      """
      ids: [ID!] = []
    ): [Project!] @requireAuth
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
      """
      New workspace name
      """
      name: String! @validate(notEmpty: true)

      """
      New workspace description
      """
      description: String

      """
      New workspace image
      """
      image: Upload @uploadImage
    ): Workspace! @requireAuth

    """
    Invite user to workspace
    Returns true if operation is successful
    """
    inviteToWorkspace(
      """
      Email of the user to invite
      """
      userEmail: String! @validate(isEmail: true)

      """
      id of the workspace to which the user is invited
      """
      workspaceId: ID!
    ): Boolean! @requireAuth

    """
    Update workspace settings
    """
    updateWorkspace(
      """
      What workspace to update
      """
      workspaceId: ID!

      """
      Workspace name
      """
      name: String! @validate(notEmpty: true)

      """
      Workspace description
      """
      description: String

      """
      Workspace image
      """
      image: Upload @uploadImage
    ): Boolean! @requireAdmin

    """
    Confirm invitation to workspace
    Returns true if operation is successful
    """
    confirmInvitation(
      """
      Hash from invitation link
      """
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
    ): Boolean! @requireAdmin

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
      userEmail: String
    ): Boolean! @requireAdmin

    """
    Mutation in order to leave workspace
    Returns true if operation is successful
    """
    leaveWorkspace(
      """
      Workspace ID
      """
      workspaceId: ID!
    ): Boolean! @requireAuth
  }
`;
