import { SenderWorkerTaskType } from './task-type';
import { SenderWorkerTask, SenderWorkerPayload } from './task';

/**
 * Payload of the task to notify the user about workspace plan prolongation
 */
export interface PaymentFailedNotificationPayload extends SenderWorkerPayload {
  /**
   * Workspace id the user tried to pay for
   */
  workspaceId: string;

  /**
   * Rejection reason
   */
  reason: string;
}

/**
 * Task to notify the user about workspace plan prolongation
 */
export interface PaymentFailedNotificationTask extends SenderWorkerTask<PaymentFailedNotificationPayload> {
  type: SenderWorkerTaskType.PaymentFailed;
}