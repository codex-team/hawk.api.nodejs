import { SenderWorkerTaskType } from './task-type';
import { SenderWorkerTask, SenderWorkerPayload } from './task';

/**
 * Payload of the task to notify the user about the assignment to the task
 */
export interface PaymentSuccessNotificationPayload extends SenderWorkerPayload {
  /**
   * Id of the user who paid
   */
  userId: string;

  /**
   * Workspace id whose plan was paid for
   */
  workspaceId: string;

  /**
   * The plan that was paid for
   */
  tariffPlanId: string;
}

/**
 * Task to notify the user about the assignment to the task
 */
export interface PaymentSuccessNotificationTask extends SenderWorkerTask<PaymentSuccessNotificationPayload> {
  type: SenderWorkerTaskType.PaymentSuccess;
}