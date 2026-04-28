import { UserInputError } from 'apollo-server-express';
import { ObjectId } from 'mongodb';
import sendPersonalNotification from '../../utils/personalNotifications';
import type { UserDBScheme } from '@hawk.so/types';
import { SenderWorkerTaskType } from '../../types/userNotifications/task-type';

/**
 * Validate and normalize bulk event ids from resolver input.
 *
 * @param {string[]} eventIds - raw event ids from GraphQL input
 * @returns {object} normalized ids grouped by validity
 */
export function parseBulkEventIds(eventIds: string[]): { validEventIds: string[]; invalidEventIds: string[] } {
  if (!eventIds || !eventIds.length) {
    throw new UserInputError('eventIds must contain at least one id');
  }

  const uniqueEventIds = [ ...new Set(eventIds.map(id => String(id))) ];
  const invalidEventIds: string[] = [];
  const validEventIds: string[] = [];

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

type AssigneeNotificationParams = {
  assigneeData: UserDBScheme | null;
  assigneeId: string;
  projectId: string;
  whoAssignedId: string;
  eventId: string;
};

/**
 * Enqueue one assignee notification without blocking resolver response.
 */
export function enqueueAssigneeNotification({
  assigneeData,
  assigneeId,
  projectId,
  whoAssignedId,
  eventId,
}: AssigneeNotificationParams): void {
  if (!assigneeData) {
    return;
  }

  sendPersonalNotification(assigneeData, {
    type: SenderWorkerTaskType.Assignee,
    payload: {
      assigneeId,
      projectId,
      whoAssignedId,
      eventId,
    },
  }).catch((error: unknown) => {
    console.error('Failed to enqueue assignee notification', error);
  });
}
