import { SenderWorkerTaskType } from './task-type';
import { SenderWorkerTask, SenderWorkerPayload } from './task';

/**
 * The new generated password that the user will receive in the email
 */
export interface PasswordResetNotificationPayload extends SenderWorkerPayload {
  newPassword: string;
}

/**
 * Task for sending a message with new user password
 */
export interface PasswordResetNotificationTask extends SenderWorkerTask<PasswordResetNotificationPayload> {
  type: SenderWorkerTaskType.PasswordReset;
}