import { gql } from 'apollo-server-express';

export default gql`
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

    """ True if workspace is used for debugging """
    isDebug: Boolean

    """ True if workspace is blocked """
    isBlocked: Boolean

    """
    For prepaid workspaces, date until which the workspace is paid
    """
    paidUntil: DateTime

    """
    Workspace projects array
    """
    projects(
      """
      Project(s) id(s)
      """
      ids: [ID!] = []
    ): [Project!]

    """
    SSO configuration (admin only, returns null for non-admin users)
    """
    sso: WorkspaceSsoConfig @definedOnlyForAdmins
  }

  """
  SAML attribute mapping configuration
  """
  type SamlAttributeMapping {
    """
    Attribute name for email in SAML Assertion
    Used to map the email attribute from the SAML response to the email attribute in the Hawk database
    """
    email: String!

    """
    Attribute name for user name in SAML Assertion
    Used to map the name attribute from the SAML response to the name attribute in the Hawk database
    """
    name: String
  }

  """
  SAML SSO configuration
  """
  type SamlConfig {
    """
    IdP Entity ID
    Used to ensure that the SAML response is coming from the correct IdP
    """
    idpEntityId: String!

    """
    SSO URL
    Used to redirect user to the correct IdP
    """
    ssoUrl: String!

    """
    X.509 certificate (masked for security)
    Used to verify the signature of the SAML response
    """
    x509Cert: String!

    """
    NameID format
    Used to specify the format of the NameID in the SAML response
    """
    nameIdFormat: String

    """
    Attribute mapping
    Used to map the attributes from the SAML response to the attributes in the Hawk database
    """
    attributeMapping: SamlAttributeMapping!
  }

  """
  SSO configuration (admin only)
  """
  type WorkspaceSsoConfig {
    """
    Is SSO enabled
    Used to enable or disable SSO for the workspace
    """
    enabled: Boolean!

    """
    Is SSO enforced
    Used to enforce SSO login for the workspace. If true, only SSO login is allowed.
    """
    enforced: Boolean!

    """
    SSO provider type
    Used to specify the type of the SSO provider for the workspace
    """
    type: String!

    """
    SAML-specific configuration
    Used to configure the SAML-specific settings for the workspace
    """
    saml: SamlConfig!
  }

  """
  SAML attribute mapping input
  """
  input SamlAttributeMappingInput {
    """
    Attribute name for email in SAML Assertion
    Used to map the email attribute from the SAML response to the email attribute in the Hawk database
    """
    email: String!

    """
    Attribute name for user name in SAML Assertion
    Used to map the name attribute from the SAML response to the name attribute in the Hawk database
    """
    name: String
  }

  """
  SAML SSO configuration input
  """
  input SamlConfigInput {
    """
    IdP Entity ID
    Used to ensure that the SAML response is coming from the correct IdP
    """
    idpEntityId: String!

    """
    SSO URL for redirecting user to IdP
    Used to redirect user to the correct IdP
    """
    ssoUrl: String!

    """
    X.509 certificate for signature verification (PEM format)
    Used to verify the signature of the SAML response
    """
    x509Cert: String!

    """
    Desired NameID format
    Used to specify the format of the NameID in the SAML response
    """
    nameIdFormat: String

    """
    Attribute mapping configuration
    Used to map the attributes from the SAML response to the attributes in the Hawk database
    """
    attributeMapping: SamlAttributeMappingInput!
  }

  """
  SSO configuration input
  """
  input WorkspaceSsoConfigInput {
    """
    Is SSO enabled
    Used to enable or disable SSO for the workspace
    """
    enabled: Boolean!

    """
    Is SSO enforced (only SSO login allowed)
    Used to enforce SSO login for the workspace. If true, only SSO login is allowed.
    """
    enforced: Boolean!

    """
    SAML-specific configuration
    Used to configure the SAML-specific settings for the workspace
    """
    saml: SamlConfigInput!
  }

  """
  Workspace preview with basic public info
  Contains only basic fields: id, name, image
  Used for public-facing features like SSO login page
  """
  type WorkspacePreview {
    """
    Workspace ID
    """
    id: ID! @renameFrom(name: "_id")

    """
    Workspace name
    """
    name: String!

    """
    Workspace image/logo URL
    """
    image: String
  }

  extend type Query {
    """
    Returns workspace(s) info
    If ids = [] returns all user's workspaces
    """
    workspaces("Workspace(s) id(s)" ids: [ID] = []): [Workspace]

    """
    Get workspace public info by ID for SSO login page
    Returns only id, name, image if SSO is enabled for the workspace
    Available without authentication
    """
    ssoWorkspace("Workspace ID" id: ID!): WorkspacePreview @allowAnon
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
    ): Workspace!

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
    ): Boolean!

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
    Join to workspace by invite link with hash
    """
    joinByInviteLink(
      """
      Workspace invite hash from link
      """
      inviteHash: String!
    ): UpdateWorkspaceResponse!

    """
    Confirm invitation to workspace
    Returns true if operation is successful
    """
    confirmInvitation(
      """
      Hash from invitation link
      """
      inviteHash: String!

      """
      Id of the workspace to which the user was invited
      """
      workspaceId: ID!
    ): UpdateWorkspaceResponse!

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
    ): Boolean!

    """
    Update workspace SSO configuration (admin only)
    """
    updateWorkspaceSso(
      workspaceId: ID!
      config: WorkspaceSsoConfigInput!
    ): Boolean! @requireAdmin
  }
`;
