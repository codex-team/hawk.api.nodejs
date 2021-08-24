import { SenderWorkerTaskType } from './task-type';
import { SenderWorkerTask, SenderWorkerPayload } from './task';

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