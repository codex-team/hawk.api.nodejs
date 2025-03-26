import { gql } from 'apollo-server-express';

import billing from './billing';
import event from './event';
import notifications from './notifications';
import notificationsInput from './notificationsInput';
import projectNotifications from './projectNotifications';
import projectNotificationsMutations from './projectNotificationsMutations';
import projectEventGroupingPattern from './projectEventGroupingPattern';
import projectEventGroupingPatternMutations from './projectEventGroupingPatternMutations';
import project from './project';
import user from './user';
import userNotifications from './userNotifications';
import userNotificationsMutations from './userNotificationsMutations';
import workspace from './workspace';
import workspaceMutations from './workspaceMutations';
import chart from './chart';
import plans from './plans';
import seed from './seed';
import release from './release';
import isE2E from '../utils/isE2E';

const rootSchema = gql`
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
  release,
  projectEventGroupingPattern,
  projectEventGroupingPatternMutations,
];

if (isE2E) {
  typeDefinitions.push(seed);
}

export default typeDefinitions;
