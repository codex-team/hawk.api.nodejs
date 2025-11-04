const EventsFactory = require('../models/eventsFactory');
const { ObjectID } = require('mongodb');
const sendPersonalNotification = require('../utils/personalNotifications').default;

/**
 * Returns a per-request, per-project EventsFactory instance
 * Uses context.eventsFactoryCache to memoize by projectId
 * @param {any} context - GraphQL resolver context
 * @param {string|ObjectID} ctorProjectId - value passed to EventsFactory constructor
 * @param {string|ObjectID} keyProjectId - value used as cache key (string id is preferred)
 * @returns {EventsFactory}
 */
function getEventsFactoryForProjectId(context, ctorProjectId, keyProjectId) {
  const cache = context.eventsFactoryCache || (context.eventsFactoryCache = new Map());
  const cacheKey = (keyProjectId || ctorProjectId).toString();

  if (!cache.has(cacheKey)) {
    cache.set(cacheKey, new EventsFactory(ctorProjectId));
  }

  return cache.get(cacheKey);
}

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
      const factory = getEventsFactoryForProjectId(context, projectId, projectId);

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
        return [await factories.usersFactory.findById(user.id)];
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
      const factory = getEventsFactoryForProjectId(context, new ObjectID(projectId), projectId);

      return factory.findChartData(days, timezoneOffset, groupHash);
    },

    /**
     * Return release data for the event
     *
     * @param {string} projectId - event's project
     * @param {String} eventId - event id
     * @returns {Promise<Release>}
     */
    async release({ projectId, id: eventId }, _args, context) {
      const factory = getEventsFactoryForProjectId(context, new ObjectID(projectId), projectId);
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
      const factory = getEventsFactoryForProjectId(context, projectId, projectId);

      const { result } = await factory.visitEvent(eventId, user.id);

      return !!result.ok;
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
      const factory = getEventsFactoryForProjectId(context, project, project);

      const { result } = await factory.toggleEventMark(eventId, mark);

      return !!result.ok;
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
      const factory = getEventsFactoryForProjectId(context, projectId, projectId);

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

      const { result } = await factory.updateAssignee(eventId, assignee);

      const assigneeData = await factories.usersFactory.dataLoaders.userById.load(assignee);

      await sendPersonalNotification(assigneeData, {
        type: 'assignee',
        payload: {
          assigneeId: assignee,
          projectId,
          whoAssignedId: user.id,
          eventId,
        },
      });

      return {
        success: !!result.ok,
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
      const factory = getEventsFactoryForProjectId(context, projectId, projectId);

      const { result } = await factory.updateAssignee(eventId, '');

      return {
        success: !!result.ok,
      };
    },
  },
};
