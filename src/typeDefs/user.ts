import { gql } from 'apollo-server-express';

export default gql`
  """
  Authentication token
  """
  type Tokens {
    """
    User's access token
    """
    accessToken: String!
    """
    User's refresh token for getting new token pair
    """
    refreshToken: String!
  }

  """
  Represent User type
  """
  type User {
    """
    User's id
    """
    id: ID! @renameFrom(name: "_id")

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
    User notifications settings
    """
    notifications: UserNotificationsSettings
  }

  extend type Query {
    """
    Returns authenticated user data
    """
    me: User @requireAuth
  }

  extend type Mutation {
    """
    Register user with provided email. Returns true if registred
    """
    signUp("Registration email" email: String!): Boolean!

    """
    Login user with provided email and password
    """
    login(
      "User email"
      email: String!

      "User password"
      password: String!
    ): Tokens!

    """
    Update user's tokens pair
    """
    refreshTokens(
      "Refresh token for getting new token pair"
      refreshToken: String!
    ): Tokens!

    """
    Reset user's password
    """
    resetPassword("User email" email: String!): Boolean!

    """
    Update user's profile
    """
    updateProfile(
      "User name"
      name: String!

      "User email"
      email: String!

      "User image file"
      image: Upload @uploadImage
    ): Boolean! @requireAuth

    """
    Change user password
    """
    changePassword(
      """
      Current user password
      """
      oldPassword: String!

      """
      New user password
      """
      newPassword: String!
    ): Boolean! @requireAuth
  }
`;
