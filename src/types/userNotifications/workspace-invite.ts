import { SenderWorkerTaskType } from './task-type';
import { SenderWorkerTask, SenderWorkerPayload } from './task';

/**
 * The new generated password that the user will receive in the email
 */
export interface WorkspaceInviteNotificationPayload extends SenderWorkerPayload {
  /**
   * Name of the workspace to which the user was invited
   */
  workspaceName: string;

  /**
   * Link to join into workspace
   */
  inviteLink: string;
}

/**
 * Task for sending a message with new user password
 */
export interface WorkspaceInviteNotificationTask extends SenderWorkerTask<WorkspaceInviteNotificationPayload> {
  type: SenderWorkerTaskType.WorkspaceInvite;
}