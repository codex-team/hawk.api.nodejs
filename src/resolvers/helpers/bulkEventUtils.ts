import { UserInputError } from 'apollo-server-express';
import { ObjectId } from 'mongodb';
import sendPersonalNotification from '../../utils/personalNotifications';
import type { UserDBScheme } from '@hawk.so/types';
import { SenderWorkerTaskType } from '../../types/userNotifications/task-type';

/**
 * Validate and normalize bulk event ids from resolver input.
 *
 * @param eventIds - raw event ids from GraphQL input
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

/**
 * Merge failed ids returned by factory with invalid ids from resolver validation.
 */
export function mergeFailedEventIds(result: { failedEventIds?: string[] }, invalidEventIds: string[]): string[] {
  return [ ...new Set([ ...(result.failedEventIds || []), ...invalidEventIds ]) ];
}

/**
 * Merge resolver-level invalid ids into factory-level failed ids.
 */
export function withMergedInvalidEventIds<T extends { failedEventIds?: string[] }>(
  result: T,
  invalidEventIds: string[]
): T & { failedEventIds: string[] } {
  return {
    ...result,
    failedEventIds: mergeFailedEventIds(result, invalidEventIds),
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

  void sendPersonalNotification(assigneeData, {
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

/**
 * Enqueue assignee notifications for all updated original events.
 */
export function enqueueBulkAssigneeNotifications({
  assigneeData,
  assigneeId,
  projectId,
  whoAssignedId,
  eventIds,
}: Omit<AssigneeNotificationParams, 'eventId'> & { eventIds: string[] }): void {
  eventIds.forEach((eventId) => {
    enqueueAssigneeNotification({
      assigneeData,
      assigneeId,
      projectId,
      whoAssignedId,
      eventId,
    });
  });
}
