import BgTasks from './bgTasks';
import { WorkerPaths, PersonalNotificationPayload, WorkerPath } from '../types/bgTasks';
import { UserDBScheme } from '../models/user';

const bgTasks = new BgTasks();

/**
 * Send personal notification to current worker
 *
 * @param workerType - type of worker that will send the notification
 * @param payload - data to send
 */
function sendTo(workerType: WorkerPath, payload: PersonalNotificationPayload): void {
  bgTasks.enqueue<PersonalNotificationPayload>(workerType, {
    payload,
  });
}

/**
 * Send notification to all enable resources
 *
 * @param user - user data
 * @param payload - stringified data to send
 */
export default function sendNotification(user: UserDBScheme, payload: PersonalNotificationPayload): void {
  if (!user.notifications) {
    return;
  }

  if (user.notifications.channels.email?.isEnabled) {
    sendTo(WorkerPaths.Email, {
      ...payload,
      endpoint: user.notifications.channels.email.endpoint,
    });
  }

  if (user.notifications.channels.telegram?.isEnabled) {
    sendTo(WorkerPaths.Telegram, {
      ...payload,
      endpoint: user.notifications.channels.telegram.endpoint,
    });
  }

  if (user.notifications.channels.slack?.isEnabled) {
    sendTo(WorkerPaths.Slack, {
      ...payload,
      endpoint: user.notifications.channels.slack.endpoint,
    });
  }
}