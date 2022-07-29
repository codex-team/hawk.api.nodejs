import { gql } from 'apollo-server-express';

import billing from './billing';
import event from './event';
import notifications from './notifications';
import notificationsInput from './notificationsInput';
import projectNotifications from './projectNotifications';
import projectNotificationsMutations from './projectNotificationsMutations';
import project from './project';
import user from './user';
import userNotifications from './userNotifications';
import userNotificationsMutations from './userNotificationsMutations';
import workspace from './workspace';
import workspaceMutations from './workspaceMutations';
import chart from './chart';
import plans from './plans';
import seed from './seed';
import isE2E from '../utils/isE2E';

const rootSchema = gql`
  """
  Access to the field only to authorized users
  """
  directive @requireAuth on FIELD_DEFINITION

  """
  Access to the field only for admins
  """
  directive @requireAdmin on FIELD_DEFINITION

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
  Represents JSON objects encoded (or not) in string format
  """
  scalar EncodedJSON

  """
  Only positive numbers
  """
  scalar PositiveInt

  """
  Big int numbers
  """
  scalar Long

  """
  Uploading file
  """
  scalar Upload

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

const typeDefinitions = [
  rootSchema,
  billing,
  event,
  notifications,
  notificationsInput,
  projectNotifications,
  projectNotificationsMutations,
  project,
  user,
  userNotifications,
  userNotificationsMutations,
  workspace,
  workspaceMutations,
  chart,
  plans,
];

if (isE2E) {
  typeDefinitions.push(seed);
}

export default typeDefinitions;
