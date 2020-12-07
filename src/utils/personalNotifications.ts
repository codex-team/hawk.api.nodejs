import BgTasks from './bgTasks';
import { WorkerTypes, PersonalNotificationPayload, WorkerType } from '../types/bgTasks';
import { UserDBScheme } from '../models/user';

const bgTasks = new BgTasks();

/**
 * Send personal notification to current worker
 *
 * @param workerType - type of worker that will send the notification
 * @param payload - data to send
 */
function sendTo(workerType: WorkerType, payload: PersonalNotificationPayload): void {
  bgTasks.enqueue<PersonalNotificationPayload>(workerType, {
    payload,
  });
}

/**
 * Send notifications to all enable resources
 *
 * @param user - user data
 * @param payload - stringified data to send
 */
export default function sendNotifications(user: UserDBScheme, payload: PersonalNotificationPayload): void {
  if (!user.notifications) {
    return;
  }

  if (user.notifications.channels.email?.isEnabled) {
    sendTo(WorkerTypes.Email, payload);
  }

  if (user.notifications.channels.telegram?.isEnabled) {
    sendTo(WorkerTypes.Telegram, payload);
  }

  if (user.notifications.channels.slack?.isEnabled) {
    sendTo(WorkerTypes.Slack, payload);
  }
}