import { ReceiveTypes } from '@hawk.so/types';
import * as telegram from '../utils/telegram';
const mongo = require('../mongo');
const { ApolloError, UserInputError } = require('apollo-server-express');
const Validator = require('../utils/validator');
const UserInProject = require('../models/userInProject');
const EventsFactory = require('../models/eventsFactory');
const ProjectToWorkspace = require('../models/projectToWorkspace');
const { dateFromObjectId } = require('../utils/dates');
const ProjectModel = require('../models/project').default;

const EVENTS_GROUP_HASH_INDEX_NAME = 'groupHashUnique';
const REPETITIONS_GROUP_HASH_INDEX_NAME = 'groupHash_hashed';
const REPETITIONS_USER_ID_INDEX_NAME = 'userId';
const MAX_SEARCH_QUERY_LENGTH = 50;

/**
 * See all types and fields here {@see ../typeDefs/project.graphql}
 */
module.exports = {
  Query: {
    /**
     * Returns project's Model
     * @param {ResolverObj} _obj
     * @param {String} projectId - project id
     * @param {ContextFactories} factories - factories for working with models
     * @return {Promise<ProjectDBScheme>}
     */
    async project(_obj, { projectId }, { factories }) {
      return factories.projectsFactory.findById(projectId);
    },
  },
  Mutation: {
    /**
     * Creates project
     *
     * @param {ResolverObj} _obj
     * @param {string} workspaceId - workspace ID
     * @param {string} name - project name
     * @param {string} image - project logo
     * @param {UserInContext} user - current authorized user {@see ../index.js}
     * @param {ContextFactories} factories - factories for working with models
     * @return {Project[]}
     */
    async createProject(_obj, { workspaceId, name, image }, { user, factories }) {
      const workspace = await factories.workspacesFactory.findById(workspaceId);

      if (!workspace) {
        throw new UserInputError('No such workspace');
      }

      const options = {
        name,
        workspaceId,
        uidAdded: user.id,
        image,
      };

      let project = await factories.projectsFactory.create(options);
      const userData = await factories.usersFactory.findById(user.id);

      try {
        await project.createNotificationsRule({
          uidAdded: user.id,
          isEnabled: true,
          whatToReceive: ReceiveTypes.SEEN_MORE,
          including: [],
          excluding: [],
          threshold: 20,
          thresholdPeriod: 3600000,
          channels: {
            email: {
              isEnabled: true,
              endpoint: userData.email,
              minPeriod: 60,
            },
            telegram: {
              isEnabled: false,
              endpoint: '',
              minPeriod: 60,
            },
            slack: {
              isEnabled: false,
              endpoint: '',
              minPeriod: 60,
            },
          },
        }, true);

        project = await factories.projectsFactory.findById(project._id);
      } catch (err) {
        telegram.sendMessage(`❌ Failed to enable default notifications for project ${name}`);
      }

      /**
       * Create collections for storing events and setup indexes
       */
      const projectEventsCollection = await mongo.databases.events.createCollection('events:' + project._id);

      const projectRepetitionsEventsCollection = await mongo.databases.events.createCollection('repetitions:' + project._id);

      await mongo.databases.events.createCollection('dailyEvents:' + project._id);

      await projectEventsCollection.createIndex({
        groupHash: 1,
      },
      {
        unique: true,
        name: EVENTS_GROUP_HASH_INDEX_NAME,
      });

      await projectRepetitionsEventsCollection.createIndex({
        groupHash: 'hashed',
      },
      {
        name: REPETITIONS_GROUP_HASH_INDEX_NAME,
      });

      await projectRepetitionsEventsCollection.createIndex({
        'payload.user.id': 1,
      }, {
        name: REPETITIONS_USER_ID_INDEX_NAME,
        sparse: true,
      });

      telegram.sendMessage(`🤯 Project ${name} was created`);

      return project;
    },

    /**
     * Update project settings
     *
     * @param {ResolverObj} _obj
     * @param {string} projectId - id of the updated project
     * @param {string} name - project name
     * @param {string} description - project description
     * @param {string} - project logo
     * @param {UserInContext} user - current authorized user {@see ../index.js}
     * @param {ContextFactories} factories - factories for working with models
     *
     * @returns {Project}
     */
    async updateProject(_obj, { id, name, description, image }, { user, factories }) {
      if (!Validator.string(name)) {
        throw new UserInputError('Invalid name length');
      }

      if (!Validator.string(description, 0)) {
        throw new UserInputError('Invalid description length');
      }

      const project = await factories.projectsFactory.findById(id);

      if (!project) {
        throw new ApolloError('There is no project with that id');
      }

      if (project.workspaceId.toString() === '6213b6a01e6281087467cc7a') {
        throw new ApolloError('Unable to update demo project');
      }

      try {
        const options = {
          name,
          description,
        };

        if (image) {
          options.image = image;
        }

        return project.updateProject(options);
      } catch (err) {
        throw new ApolloError('Something went wrong');
      }
    },

    /**
     * Generates new project integration token by id
     *
     * @param {ResolverObj} _obj - default resolver object
     * @param {string} id - id of the project in which the token field is being regenerated
     * @param {UserInContext} user - current authorized user {@see ../index.js}
     * @param {ContextFactories} factories - factories for working with models
     *
     * @returns {Object}
     */
    async generateNewIntegrationToken(_obj, { id }, { factories }) {
      const project = await factories.projectsFactory.findById(id);

      if (!project) {
        throw new ApolloError('There is no project with that id:', id);
      }

      const integrationId = project.integrationId || ProjectModel.generateIntegrationId();

      const encodedIntegrationToken = ProjectModel.generateIntegrationToken(integrationId);

      try {
        const updatedProject = await project.updateProject({
          token: encodedIntegrationToken,
          integrationId,
        });

        return {
          recordId: updatedProject._id,
          record: updatedProject,
        };
      } catch (err) {
        throw new ApolloError('Can\'t update integration token', err);
      }
    },

    /**
     * Remove project
     *
     * @param {ResolverObj} _obj
     * @param {string} projectId - id of the updated project
     * @param {UserInContext} user - current authorized user {@see ../index.js}
     * @param {ContextFactories} factories - factories for working with models
     *
     * @returns {Promise<boolean>}
     */
    async removeProject(_obj, { projectId }, { user, factories }) {
      const project = await factories.projectsFactory.findById(projectId);

      if (!project) {
        throw new ApolloError('There is no project with that id');
      }

      if (project.workspaceId.toString() === '6213b6a01e6281087467cc7a') {
        throw new ApolloError('Unable to remove demo project');
      }

      const workspaceModel = await factories.workspacesFactory.findById(project.workspaceId.toString());

      /**
       * Remove project events
       */
      await new EventsFactory(project._id).remove();

      /**
       * Remove project from workspace
       */
      await new ProjectToWorkspace(workspaceModel._id.toString()).remove(project._id);

      /**
       * Remove project
       */
      await project.remove();

      return true;
    },

    /**
     * Updates user visit time on project and returns it
     *
     * @param {ResolverObj} _obj
     * @param {String} projectId - project ID
     * @param {Context.user} user - current authorized user {@see ../index.js}
     * @return {Promise<Number>}
     */
    async updateLastProjectVisit(_obj, { projectId }, { user }) {
      const userInProject = new UserInProject(user.id, projectId);

      return userInProject.updateLastVisit();
    },
  },
  Project: {
    /**
     * Returns project creation date
     *
     * @param {ProjectDBScheme} project - result of parent resolver
     *
     * @returns {Date}
     */
    creationDate(project) {
      return dateFromObjectId(project._id);
    },

    /**
     * Find project's event
     *
     * @param {ProjectDBScheme} project - result of parent resolver
     * @param {String} eventId - event's identifier
     * @param {String} originalEventId - id of the original event
     *
     * @returns {EventRepetitionSchema}
     */
    async event(project, { eventId: repetitionId, originalEventId }) {
      console.log(`event resolver in project: ${repetitionId}, ${originalEventId}`)

      const factory = new EventsFactory(project._id);
      const repetition = await factory.getEventRepetition(repetitionId, originalEventId);

      console.log('repetition', repetition)

      if (!repetition) {
        return null;
      }

      repetition.projectId = project._id;

      return repetition;
    },

    /**
     * Find project events
     *
     * @param {ProjectDBScheme} project - result of parent resolver
     * @param {number} limit - query limit
     * @param {number} skip - query skip
     * @param {Context.user} user - current authorized user {@see ../index.js}
     * @returns {Event[]}
     */
    async events(project, { limit, skip }) {
      const factory = new EventsFactory(project._id);

      return factory.find({}, limit, skip);
    },

    /**
     * Returns events count that wasn't seen on project
     *
     * @param {ProjectDBScheme} project - result of parent resolver
     * @param {Object} data - additional data. In this case it is empty
     * @param {User} user - authorized user
     *
     * @return {Promise<number>}
     */
    async unreadCount(project, data, { user }) {
      const eventsFactory = new EventsFactory(project._id);
      const userInProject = new UserInProject(user.id, project._id);
      const lastVisit = await userInProject.getLastVisit();

      return eventsFactory.getUnreadCount(lastVisit);
    },

    /**
     * Returns recent Events grouped by day
     *
     * @param {ProjectDBScheme} project - result of parent resolver
     * @param {Number} limit - limit for events count
     * @param {String} cursor - pointer to the next portion of dailyEvents
     * @param {'BY_DATE' | 'BY_COUNT'} sort - events sort order
     * @param {EventsFilters} filters - marks by which events should be filtered
     * @param {String} search - search query
     *
     * @return {Promise<RecentEventSchema[]>}
     */
    async dailyEventsPortion(project, { limit, nextCursor, sort, filters, search }) {
      if (search) {
        if (search.length > MAX_SEARCH_QUERY_LENGTH) {
          search = search.slice(0, MAX_SEARCH_QUERY_LENGTH);
        }
      }

      const factory = new EventsFactory(project._id);

      const dailyEventsPortion = await factory.findDailyEventsPortion(limit, nextCursor, sort, filters, search);

      return dailyEventsPortion;
    },

    /**
     * Returns data about how many events accepted at each of passed N days
     *
     * @param {ProjectDBScheme} project - result of parent resolver
     * @param {Number} days - how many days we need to fetch for displaying in a charts
     * @param {number} timezoneOffset - user's local timezone offset in minutes
     *
     * @return {Promise<ProjectChartItem[]>}
     */
    async chartData(project, { days, timezoneOffset }) {
      const factory = new EventsFactory(project._id);

      return factory.findChartData(days, timezoneOffset);
    },
  },
};
