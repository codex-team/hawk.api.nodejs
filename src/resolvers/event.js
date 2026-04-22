const getEventsFactory = require('./helpers/eventsFactory').default;
const {
  fireAndForgetAssigneeNotifications,
  parseBulkEventIds,
  mergeFailedEventIds,
} = require('./helpers/bulkEvents');
const { aiService } = require('../services/ai');
const { UserInputError } = require('apollo-server-express');

/**
 * See all types and fields here {@see ../typeDefs/event.graphql}
 */
module.exports = {
  EventMarks: {
    starred(marks) {
      return 'starred' in marks;
    },
    ignored(marks) {
      return 'ignored' in marks;
    },
    resolved(marks) {
      return 'resolved' in marks;
    },
  },
  Event: {

    /**
     * Returns repetitions portion of the event
     *
     * @param {String} projectId - id of the project got from the parent node (event)
     * @param {String} originalEventId - id of the original event of the repetitions to get, got from parent node (event)
     * @param {Number} limit - argument of the query, maximal count of the repetitions in one portion
     * @param {Number|null} cursor - pointer to the next portion of repetition, could be null if we want to get first portion
     *
     * @return {RepetitionsPortion}
     */
    async repetitionsPortion({ projectId, originalEventId }, { limit, cursor }, context) {
      const factory = getEventsFactory(context, projectId);

      return factory.getEventRepetitions(originalEventId, limit, cursor);
    },

    /**
     * Returns users who visited event
     * @param {string[]} visitedBy - id's users who visited event
     * @param _args - query args (empty)
     * @param factories - factories for working with models
     * @return {Promise<UserModel[]> | null}
     */
    async visitedBy({ visitedBy, projectId }, _args, { factories, user }) {
      /**
       * Crutch for Demo Workspace
       */
      const project = await factories.projectsFactory.findById(projectId);

      if (project.workspaceId.toString() === '6213b6a01e6281087467cc7a') {
        return [ await factories.usersFactory.findById(user.id) ];
      }

      if (!visitedBy || !visitedBy.length) {
        return [];
      }

      return visitedBy.map(userId => factories.usersFactory.findById(userId));
    },

    /**
     * Returns the user assigneed to the event
     *
     * @param {string} assignee - user id
     * @param _args - query args (empty)
     * @param factories - factories for working with models
     * @return {Promise<UserModel> | null}
     */
    async assignee({ assignee }, _args, { factories }) {
      if (!assignee || !assignee.length) {
        return null;
      }

      return factories.usersFactory.dataLoaders.userById.load(assignee);
    },

    /**
     * Return chart data for target event occured in last few days
     *
     * @param {string} projectId - event's project
     * @param {string} groupHash - event's groupHash
     * @param {number} days - how many days we need to fetch for displaying in a charts
     * @param {number} timezoneOffset - user's local timezone offset in minutes
     * @returns {Promise<ProjectChartItem[]>}
     */
    async chartData({ projectId, groupHash }, { days, timezoneOffset }, context) {
      const factory = getEventsFactory(context, projectId);

      return factory.getEventDailyChart(groupHash, days, timezoneOffset);
    },

    /**
     * Return AI suggestion for the event
     *
     * @param {string} projectId - event's project
     * @param {string} eventId - event id
     * @param {string} originalEventId - original event id
     * @returns {Promise<string>} AI suggestion for the event
     */
    async aiSuggestion({ projectId, _id: eventId, originalEventId }, _args, context) {
      const factory = getEventsFactory(context, projectId);

      return aiService.generateSuggestion(factory, eventId, originalEventId);
    },

    /**
     * Return release data for the event
     *
     * @param {string} projectId - event's project
     * @param {String} eventId - event id
     * @returns {Promise<Release>}
     */
    async release({ projectId, id: eventId }, _args, context) {
      const factory = getEventsFactory(context, projectId);
      const release = await factory.getEventRelease(eventId);

      return release;
    },
  },
  Mutation: {
    /**
     * Mark event as visited for current user
     *
     * @param {ResolverObj} _obj - resolver context
     * @param {string} projectId - project id
     * @param {string} eventId - event id
     * @param {UserInContext} user - user context
     * @return {Promise<boolean>}
     */
    async visitEvent(_obj, { projectId, eventId }, { user, ...context }) {
      const factory = getEventsFactory(context, projectId);

      const result = await factory.visitEvent(eventId, user.id);

      return !!result.acknowledged;
    },
    /**
     * Mark many original events as visited for current user
     *
     * @param {ResolverObj} _obj - resolver context
     * @param {string} projectId - project id
     * @param {string[]} eventIds - original event ids
     * @param {UserInContext} user - user context
     * @returns {Promise<{ updatedCount: number, updatedEventIds: string[], failedEventIds: string[] }>}
     */
    async bulkVisitEvents(_obj, { projectId, eventIds }, { user, ...context }) {
      const { validEventIds, invalidEventIds } = parseBulkEventIds(eventIds);

      if (validEventIds.length === 0) {
        return {
          updatedCount: 0,
          updatedEventIds: [],
          failedEventIds: invalidEventIds,
        };
      }

      const factory = getEventsFactory(context, projectId);
      const result = await factory.bulkVisitEvent(validEventIds, user.id);

      return {
        ...result,
        failedEventIds: mergeFailedEventIds(result, invalidEventIds),
      };
    },

    /**
     * Mark event with one of the event marks
     *
     * @param {ResolverObj} _obj - resolver context
     * @param {string} project - project id
     * @param {string} id - event id
     * @param {string} mark - mark to set
     * @return {Promise<boolean>}
     */
    async toggleEventMark(_obj, { project, eventId, mark }, context) {
      const factory = getEventsFactory(context, project);

      const result = await factory.toggleEventMark(eventId, mark);

      return !!result.acknowledged;
    },

    /**
     * Bulk set resolved/ignored: always set mark on events that lack it, unless all selected
     * already have the mark — then remove from all.
     *
     * @param {ResolverObj} _obj - resolver context
     * @param {string} projectId - project id
     * @param {string[]} eventIds - original event ids
     * @param {string} mark - EventMark enum value
     * @param {object} context - gql context
     * @return {Promise<{ updatedCount: number, updatedEventIds: string[], failedEventIds: string[] }>}
     */
    async bulkToggleEventMarks(_obj, { projectId, eventIds, mark }, context) {
      const { validEventIds, invalidEventIds } = parseBulkEventIds(eventIds);

      if (validEventIds.length === 0) {
        return {
          updatedCount: 0,
          updatedEventIds: [],
          failedEventIds: invalidEventIds,
        };
      }

      const factory = getEventsFactory(context, projectId);
      const result = await factory.bulkToggleEventMark(validEventIds, mark);

      return {
        ...result,
        failedEventIds: mergeFailedEventIds(result, invalidEventIds),
      };
    },

    /**
     * Mutations namespace
     *
     * @return {Function()}
     */
    events: () => ({}),
  },
  EventsMutations: {
    /**
     * Update assignee to selected event
     *
     * @param {ResolverObj} _obj - resolver context
     * @param {UpdateAssigneeInput} input - object of arguments
     * @param factories - factories for working with models
     * @return {Promise<boolean>}
     */
    async updateAssignee(_obj, { input }, { factories, user, ...context }) {
      const { projectId, eventId, assignee } = input;
      const factory = getEventsFactory(context, projectId);

      const userExists = await factories.usersFactory.findById(assignee);

      if (!userExists) {
        return {
          success: false,
        };
      }

      const project = await factories.projectsFactory.findById(projectId);
      const workspaceId = project.workspaceId;
      const workspace = await factories.workspacesFactory.findById(workspaceId);
      const assigneeExistsInWorkspace = await workspace.getMemberInfo(assignee);

      if (!assigneeExistsInWorkspace) {
        return {
          success: false,
        };
      }

      const result = await factory.updateAssignee(eventId, assignee);

      const assigneeData = await factories.usersFactory.dataLoaders.userById.load(assignee);

      fireAndForgetAssigneeNotifications({
        assigneeData,
        eventIds: [ eventId ],
        projectId,
        assigneeId: assignee,
        whoAssignedId: user.id,
      });

      return {
        success: !!result.acknowledged,
        record: assigneeData,
      };
    },

    /**
     * Remove an assignee from the selected event
     *
     * @param {ResolverObj} _obj - resolver context
     * @param {RemoveAssigneeInput} input - object of arguments
     * @param factories - factories for working with models
     * @return {Promise<boolean>}
     */
    async removeAssignee(_obj, { input }, context) {
      const { projectId, eventId } = input;
      const factory = getEventsFactory(context, projectId);

      const result = await factory.updateAssignee(eventId, '');

      return {
        success: !!result.acknowledged,
      };
    },

    /**
     * Bulk set/clear assignee for selected original events
     *
     * @param {ResolverObj} _obj - resolver context
     * @param {BulkUpdateAssigneeInput} input - object of arguments
     * @param factories - factories for working with models
     * @return {Promise<{ updatedCount: number, updatedEventIds: string[], failedEventIds: string[] }>}
     */
    async bulkUpdateAssignee(_obj, { input }, { factories, user, ...context }) {
      const { projectId, eventIds, assignee } = input;
      const { validEventIds, invalidEventIds } = parseBulkEventIds(eventIds);
      let assigneeData = null;

      if (validEventIds.length === 0) {
        return {
          updatedCount: 0,
          updatedEventIds: [],
          failedEventIds: invalidEventIds,
        };
      }

      const factory = getEventsFactory(context, projectId);

      if (assignee) {
        const userExists = await factories.usersFactory.findById(assignee);

        if (!userExists) {
          throw new UserInputError('assignee not found');
        }

        assigneeData = userExists;

        const project = await factories.projectsFactory.findById(projectId);
        const workspace = await factories.workspacesFactory.findById(project.workspaceId);
        const assigneeExistsInWorkspace = await workspace.getMemberInfo(assignee);

        if (!assigneeExistsInWorkspace) {
          throw new UserInputError('assignee is not a workspace member');
        }
      }

      const result = await factory.bulkUpdateAssignee(validEventIds, assignee);
      const resultWithInvalid = {
        ...result,
        failedEventIds: mergeFailedEventIds(result, invalidEventIds),
      };

      if (assignee && resultWithInvalid.updatedEventIds.length > 0) {
        fireAndForgetAssigneeNotifications({
          assigneeData,
          eventIds: resultWithInvalid.updatedEventIds,
          projectId,
          assigneeId: assignee,
          whoAssignedId: user.id,
        });
      }

      return resultWithInvalid;
    },
  },
};
