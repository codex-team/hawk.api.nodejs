const sendPersonalNotification = require('../../utils/personalNotifications').default;
const { UserInputError } = require('apollo-server-express');
const { ObjectId } = require('mongodb');

const ASSIGNEE_NOTIFICATIONS_CHUNK_SIZE = 25;

/**
 * Enqueue assignee notifications in background (do not block resolver response)
 *
 * @param {object} args - notification args
 * @param {object} args.assigneeData - assigned user data
 * @param {string[]} args.eventIds - original event ids
 * @param {string} args.projectId - project id
 * @param {string} args.assigneeId - assignee id
 * @param {string} args.whoAssignedId - user id who performed assignment
 * @returns {void}
 */
function fireAndForgetAssigneeNotifications({
  assigneeData,
  eventIds,
  projectId,
  assigneeId,
  whoAssignedId,
}) {
  if (!assigneeData) {
    console.error('Failed to enqueue assignee notifications: assignee data is empty');

    return;
  }

  Promise.resolve()
    .then(async () => {
      const failedResults = [];

      for (let i = 0; i < eventIds.length; i += ASSIGNEE_NOTIFICATIONS_CHUNK_SIZE) {
        const chunk = eventIds.slice(i, i + ASSIGNEE_NOTIFICATIONS_CHUNK_SIZE);
        const results = await Promise.allSettled(chunk.map(eventId => sendPersonalNotification(assigneeData, {
          type: 'assignee',
          payload: {
            assigneeId,
            projectId,
            whoAssignedId,
            eventId,
          },
        })));

        failedResults.push(...results.filter(result => result.status === 'rejected'));
      }

      if (failedResults.length > 0) {
        const failedMessages = failedResults.map((result) => {
          const reason = result && result.reason;

          if (reason && typeof reason.message === 'string') {
            return reason.message;
          }

          return String(reason || 'Unknown error');
        });

        console.error('Failed to enqueue assignee notifications', {
          failedCount: failedResults.length,
          errors: failedMessages,
        });
      }
    })
    .catch((error) => {
      console.error('Failed to enqueue assignee notifications', error);
    });
}

/**
 * Validate and normalize bulk event ids from resolver input.
 *
 * @param {string[]} eventIds - raw event ids from GraphQL input
 * @returns {{ validEventIds: string[], invalidEventIds: string[] }}
 */
function parseBulkEventIds(eventIds) {
  if (!eventIds || !eventIds.length) {
    throw new UserInputError('eventIds must contain at least one id');
  }

  const uniqueEventIds = [ ...new Set(eventIds.map(id => String(id))) ];
  const invalidEventIds = [];
  const validEventIds = [];

  uniqueEventIds.forEach((id) => {
    if (ObjectId.isValid(id)) {
      validEventIds.push(id);
    } else {
      invalidEventIds.push(id);
    }
  });

  return {
    validEventIds,
    invalidEventIds,
  };
}

/**
 * Merge failed ids returned by factory with invalid ids from resolver validation.
 *
 * @param {{ failedEventIds?: string[] }} result - factory response
 * @param {string[]} invalidEventIds - invalid ids detected on resolver level
 * @returns {string[]}
 */
function mergeFailedEventIds(result, invalidEventIds) {
  return [ ...new Set([...(result.failedEventIds || []), ...invalidEventIds]) ];
}

module.exports = {
  fireAndForgetAssigneeNotifications,
  parseBulkEventIds,
  mergeFailedEventIds,
};
