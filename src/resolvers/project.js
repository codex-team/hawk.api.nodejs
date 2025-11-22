import { ReceiveTypes } from '@hawk.so/types';
import * as telegram from '../utils/telegram';
const mongo = require('../mongo');
const { ObjectId } = require('mongodb');
const { ApolloError, UserInputError } = require('apollo-server-express');
const Validator = require('../utils/validator');
const EventsFactory = require('../models/eventsFactory');
const getEventsFactory = require('./helpers/eventsFactory').default;
const ProjectToWorkspace = require('../models/projectToWorkspace');
const { dateFromObjectId } = require('../utils/dates');
const ProjectModel = require('../models/project').default;

const EVENTS_GROUP_HASH_INDEX_NAME = 'groupHashUnique';
const REPETITIONS_GROUP_HASH_INDEX_NAME = 'groupHash_hashed';
const REPETITIONS_USER_ID_INDEX_NAME = 'userId';
const EVENTS_TIMESTAMP_INDEX_NAME = 'timestamp';
const EVENTS_PAYLOAD_RELEASE_INDEX_NAME = 'payloadRelease';
const GROUPING_TIMESTAMP_INDEX_NAME = 'groupingTimestamp';
const GROUPING_TIMESTAMP_AND_LAST_REPETITION_TIME_AND_ID_INDEX_NAME = 'groupingTimestampAndLastRepetitionTimeAndId';
const GROUPING_TIMESTAMP_AND_GROUP_HASH_INDEX_NAME = 'groupingTimestampAndGroupHash';
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
            loop: {
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

      const projectDailyEventsCollection = await mongo.databases.events.createCollection('dailyEvents:' + project._id);

      await projectDailyEventsCollection.createIndex({
        groupingTimestamp: 1,
      }, {
        name: GROUPING_TIMESTAMP_INDEX_NAME,
      });

      await projectDailyEventsCollection.createIndex({
        groupingTimestamp: 1,
        groupHash: 1,
      }, {
        name: GROUPING_TIMESTAMP_AND_GROUP_HASH_INDEX_NAME,
      });

      await projectDailyEventsCollection.createIndex({
        groupingTimestamp: -1,
        lastRepetitionTime: -1,
        _id: -1,
      }, {
        name: GROUPING_TIMESTAMP_AND_LAST_REPETITION_TIME_AND_ID_INDEX_NAME,
      });

      await projectEventsCollection.createIndex({
        'payload.release': 1,
      },
      {
        name: EVENTS_PAYLOAD_RELEASE_INDEX_NAME,
        background: true,
        sparse: true,
      });

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

      await projectEventsCollection.createIndex({
        timestamp: 1,
      }, {
        name: EVENTS_TIMESTAMP_INDEX_NAME,
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
     * Update project rate limits settings
     *
     * @param {ResolverObj} _obj
     * @param {string} id - project id
     * @param {Object | null} rateLimitSettings - rate limit settings (null to remove)
     * @param {UserInContext} user - current authorized user {@see ../index.js}
     * @param {ContextFactories} factories - factories for working with models
     *
     * @returns {Project}
     */
    async updateProjectRateLimits(_obj, { id, rateLimitSettings }, { user, factories }) {
      const project = await factories.projectsFactory.findById(id);

      if (!project) {
        throw new ApolloError('There is no project with that id');
      }

      if (project.workspaceId.toString() === '6213b6a01e6281087467cc7a') {
        throw new ApolloError('Unable to update demo project');
      }

      // Validate rate limit settings if provided
      if (rateLimitSettings) {
        const { N, T } = rateLimitSettings;

        // Validate that N and T exist
        if (!N || !T) {
          throw new UserInputError(
            'Rate limit settings must contain both N (threshold) and T (period) fields.'
          );
        }

        // Validate N (threshold) - must be positive integer > 0
        if (typeof N !== 'number' || !Number.isInteger(N) || N <= 0) {
          throw new UserInputError(
            'Invalid rate limit threshold. Must be a positive integer greater than 0.'
          );
        }

        // Validate T (period) - must be positive integer >= 60 (1 minute)
        if (typeof T !== 'number' || !Number.isInteger(T) || T < 60) {
          throw new UserInputError(
            'Invalid rate limit period. Must be a positive integer greater than or equal to 60 seconds.'
          );
        }

        // Validate reasonable maximums (prevent extremely large values)
        const MAX_THRESHOLD = 1000000000; // 1 billion
        const MAX_PERIOD = 60 * 60 * 24 * 31; // 1 month in seconds

        if (N > MAX_THRESHOLD) {
          throw new UserInputError(
            `Rate limit threshold cannot exceed ${MAX_THRESHOLD.toLocaleString()}.`
          );
        }

        if (T > MAX_PERIOD) {
          throw new UserInputError(
            `Rate limit period cannot exceed ${MAX_PERIOD.toLocaleString()} seconds (1 month).`
          );
        }
      }

      try {
        return project.updateProject({
          rateLimitSettings: rateLimitSettings || null,
        });
      } catch (err) {
        throw new ApolloError('Failed to update project rate limit settings', { originalError: err });
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
    async updateLastProjectVisit(_obj, { projectId }, { user, factories }) {
      const userModel = await factories.usersFactory.findById(user.id);

      if (!userModel) {
        throw new ApolloError('User not found');
      }

      return userModel.updateLastProjectVisit(projectId);
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
    async event(project, { eventId: repetitionId, originalEventId }, context) {
      const factory = getEventsFactory(context, project._id);
      const repetition = await factory.getEventRepetition(repetitionId, originalEventId);

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
    async events(project, { limit, skip }, context) {
      const factory = getEventsFactory(context, project._id);

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
    async unreadCount(project, _args, { factories, user, ...context }) {
      const eventsFactory = getEventsFactory(context, project._id);
      const userModel = await factories.usersFactory.findById(user.id);

      if (!userModel) {
        throw new ApolloError('User not found');
      }
      const lastVisit = await userModel.getLastProjectVisit(project._id);

      return eventsFactory.getUnreadCount(lastVisit);
    },

    /**
     * Returns recent Events grouped by day
     *
     * @param {ProjectDBScheme} project - result of parent resolver
     * @param {Number} limit - limit for events count
     * @param {DailyEventsCursor} cursor - object with boundary values of the first event in the next portion
     * @param {'BY_DATE' | 'BY_COUNT'} sort - events sort order
     * @param {EventsFilters} filters - marks by which events should be filtered
     * @param {String} release - release name
     * @param {String} search - search query
     *
     * @return {Promise<RecentEventSchema[]>}
     */
    async dailyEventsPortion(project, { limit, nextCursor, sort, filters, search, release }, context) {
      if (search) {
        if (search.length > MAX_SEARCH_QUERY_LENGTH) {
          search = search.slice(0, MAX_SEARCH_QUERY_LENGTH);
        }
      }

      const factory = getEventsFactory(context, project._id);

      const dailyEventsPortion = await factory.findDailyEventsPortion(limit, nextCursor, sort, filters, search, release);

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
    async chartData(project, { startDate, endDate, groupBy, timezoneOffset }, context) {
      const factory = getEventsFactory(context, project._id);

      return factory.getProjectChartData(project._id, startDate, endDate, groupBy, timezoneOffset);
    },

    /**
     * Returns list of not archived releases with number of events that were introduced in this release
     * We count events as new, cause payload.release only contain the same release name if the event is original
     *
     * @param {ProjectDBScheme} project - result of parent resolver
     * @returns {Promise<Array<{release: string, timestamp: number, newEventsCount: number, commitsCount: number, filesCount: number}>>}
     */
    async releases(project) {
      const releasesCollection = mongo.databases.events.collection('releases');

      const pipeline = [
        { $match: { projectId: project._id.toString() } },
        {
          $project: {
            release: '$release',
            commitsCount: { $size: { $ifNull: ['$commits', [] ] } },
            filesCount: { $size: { $ifNull: ['$files', [] ] } },
            _releaseIdSec: { $floor: { $divide: [ { $toLong: { $toDate: '$_id' } }, 1000] } },
          },
        },
        {
          $lookup: {
            from: 'events:' + project._id,
            let: { rel: '$release' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ['$payload.release', '$$rel'],
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                },
              },
            ],
            as: 'eventAgg',
          },
        },
        {
          $project: {
            _id: 0,
            release: 1,
            commitsCount: 1,
            filesCount: 1,
            newEventsCount: { $ifNull: [ { $arrayElemAt: ['$eventAgg.count', 0] }, 0] },
            timestamp: '$_releaseIdSec',
          },
        },
        { $sort: { _id: -1 } },
      ];

      const cursor = releasesCollection.aggregate(pipeline);
      const result = await cursor.toArray();

      return result;
    },

    /**
     * Return detailed info for a specific release
     * @param {ProjectDBScheme} project
     * @param {Object} args
     * @param {string} args.release - release identifier
     */
    async releaseDetails(project, { release }, { factories }) {
      const releasesFactory = factories.releasesFactory;
      const releaseDoc = await releasesFactory.findByProjectAndRelease(project._id, release);

      let enrichedFiles = Array.isArray(releaseDoc.files) ? releaseDoc.files : [];

      // If there are files to enrich, try to get their metadata
      if (enrichedFiles.length > 0) {
        try {
          const fileIds = [
            ...new Set(enrichedFiles.map(file => String(file._id))),
          ].map(id => new ObjectId(id));

          if (fileIds.length > 0) {
            const filesInfo = await factories.releasesFactory.findFilesByFileIds(
              fileIds
            );

            const metaById = new Map(
              filesInfo.map(fileInfo => [String(fileInfo._id), {
                length: fileInfo.length,
                uploadDate: fileInfo.uploadDate,
              } ])
            );

            enrichedFiles = enrichedFiles.map((entry) => {
              const meta = metaById.get(String(entry._id));

              return {
                mapFileName: entry.mapFileName,
                originFileName: entry.originFileName,
                length: meta.length ? meta.length : null,
                uploadDate: meta.uploadDate ? meta.uploadDate : null,
              };
            });
          }
        } catch (e) {
          // In case of any error with enrichment, fallback to original structure
          enrichedFiles = releaseDoc.files ? releaseDoc.files : [];
        }
      }

      return {
        release,
        projectId: project._id,
        commitsCount: Array.isArray(releaseDoc.commits) ? releaseDoc.commits.length : 0,
        filesCount: Array.isArray(releaseDoc.files) ? releaseDoc.files.length : 0,
        commits: releaseDoc.commits ? releaseDoc.commits : [],
        files: enrichedFiles,
        timestamp: releaseDoc._id ? dateFromObjectId(releaseDoc._id) : null,
      };
    },
  },
};
