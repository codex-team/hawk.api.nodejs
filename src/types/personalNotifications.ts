/**
 * Types of tasks for sender worker
 */
export enum SenderWorkerTaskType {
  /**
   * Task to notify the user about the assignment to the task
   */
  Assignee = 'assignee',

  /**
   * Task to notify the user about workspace plan prolongation
   */
  PlanProlongation = 'plan-prolongation'
}

/**
 * Common payload for sender worker tasks
 */
export interface SenderWorkerPayload {
  /**
   * Endpoint to send notifications to
   */
  endpoint?: string;
}

/**
 * Task shape for sender worker
 */
export interface SenderWorkerTask<Payload extends SenderWorkerPayload> {
  /**
   * Type of task
   */
  type: SenderWorkerTaskType;

  /**
   * Payload of task
   */
  payload: Payload;
}

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

/**
 * Payload of the task to notify the user about workspace plan prolongation
 */
export interface PlanProlongationNotificationPayload extends SenderWorkerPayload {
  userId: string;
  workspaceId: string;
  tariffPlanId: string;
}

/**
 * Task to notify the user about workspace plan prolongation
 */
export interface PlanProlongationNotificationTask extends SenderWorkerTask<PlanProlongationNotificationPayload> {
  type: SenderWorkerTaskType.PlanProlongation;
}

/**
 * All task payloads
 */
export type SenderWorkerTasks = AssigneeNotificationTask | PlanProlongationNotificationTask;
