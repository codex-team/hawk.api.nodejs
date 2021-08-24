import { SenderWorkerTaskType } from './task-type';
import { SenderWorkerTask, SenderWorkerPayload } from './task';

/**
 * The primary password that the user will receive in the email
 */
export interface SignUpNotificationPayload extends SenderWorkerPayload {
  password: string;
}

/**
 * Task for sending a message after
 */
export interface SignUpNotificationTask extends SenderWorkerTask<SignUpNotificationPayload> {
  type: SenderWorkerTaskType.SignUp;
}