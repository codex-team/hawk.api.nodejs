import { gql, concatenateTypeDefs } from 'apollo-server-express';

import billing from './billing';
import event from './event';
import notify from './notify';
import project from './project';
import user from './user';
import workspace from './workspace';

const rootSchema = gql`
  """
  Access to the field only to authorized users
  """
  directive @requireAuth on FIELD_DEFINITION

  """
  Directive for field renaming
  """
  directive @renameFrom(
    "Parent's field name"
    name: String!
  ) on FIELD_DEFINITION


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
  Supported languages for data
  """
  enum Languages {
    EN
    RU
  }

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

export default concatenateTypeDefs(
  [
    rootSchema,
    billing,
    event,
    notify,
    project,
    user,
    workspace
  ]
);
