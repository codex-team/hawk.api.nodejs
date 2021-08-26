import { gql } from 'apollo-server-express';

/**
 * Mutations available only for e2e environment
 */
export default gql`
  extend type Mutation {
    """
    Creates new user
    """
    createUser(
      """
      User email
      """
      email: String! @validate(isEmail: true)
      """
      User password
      """
      password: String! @validate(notEmpty: true)
    ): User!

    """
    Deletes user by email
    """
    deleteUser(
      """
      User's email
      """
      email: String!
    ): Boolean!
  }
`;
