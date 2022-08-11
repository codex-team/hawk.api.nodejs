import { gql } from 'apollo-server-core';
import userTypedefs from './user.js';
import workspaceTypedefs from './workspace.js';

const rootTypedefs = gql`
  """
  Access to the field only to authorized users
  """
  directive @requireAuth on FIELD_DEFINITION
  """
  Access to the field only for admins
  """
  directive @requireAdmin on FIELD_DEFINITION
  """
  Directive for field renaming
  """
  directive @renameFrom(
    "Parent's field name"
    name: String!
  ) on FIELD_DEFINITION
  """
  Directive for setting field default value
  """
  directive @default(
    "Default field value encoded in JSON"
    value: String!
  ) on FIELD_DEFINITION
  """
  Directive for automatically image uploading
  """
  directive @uploadImage on ARGUMENT_DEFINITION
  """
  Directive for checking a field for empty space
  """
  directive @validate(notEmpty: Boolean, isEmail: Boolean) on ARGUMENT_DEFINITION
  """
  Directive for checking user in workspace
  """
  directive @requireUserInWorkspace on FIELD_DEFINITION

  """
  Type for date and time representation
  """
  scalar DateTime
  """
  Type for representing JSON values
  """
  scalar JSON
  """
  Type for representing JSON objects
  """
  scalar JSONObject
  
  """
  Type for representing user upload to server
  """
  scalar Upload
  
  """
  API queries
  """
  type Query {
    """
    Healthcheck endpoint
    """
    health: String!
  }

  """
  API mutations
  """
  type Mutation {
    """
    Unused field to let extend this type
    """
    _: Boolean
  }
`;

const typeDefinitions = [
  rootTypedefs,
  userTypedefs,
  workspaceTypedefs,
];

export default typeDefinitions;
