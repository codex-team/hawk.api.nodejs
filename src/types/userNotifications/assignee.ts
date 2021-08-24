import { SenderWorkerTaskType } from './task-type';
import { SenderWorkerTask, SenderWorkerPayload } from './task';

/**
 * Payload of the task to notify the user about the assignment to the task
 */
export interface AssigneeNotificationPayload extends SenderWorkerPayload {
  /**
   * ID of the user assigned to this event
   */
  assigneeId: string;

  /**
   * Project of the event
   */
  projectId: string;

  /**
   * Id of the user who has assigned a person to resolve the issue
   */
  whoAssignedId: string;

  /**
   * Id of the event
   */
  eventId: string;
}

/**
 * Task to notify the user about the assignment to the task
 */
export interface AssigneeNotificationTask extends SenderWorkerTask<AssigneeNotificationPayload> {
  type: SenderWorkerTaskType.Assignee;
}