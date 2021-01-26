import BgTasks from './bgTasks';
import { WorkerPaths, BgTask, PersonalNotification, WorkerPath } from '../types/bgTasks';
import { UserDBScheme } from '../models/user';

const bgTasks = new BgTasks();

/**
 * Send personal notification to current worker
 *
 * @param workerType - type of worker that will send the notification
 * @param task - data to send
 */
function sendTo(workerType: WorkerPath, task: BgTask): void {
  bgTasks.enqueue(workerType, task);
}

/**
 * Send notification to all enable resources
 *
 * @param user - user data
 * @param task - data to send
 */
export default function sendNotification(user: UserDBScheme, task: BgTask): void {
  if (!user.notifications) {
    return;
  }

  if (user.notifications.channels.email?.isEnabled) {
    sendTo(WorkerPaths.Email, {
      type: task.type,
      payload: {
        ...task.payload,
        endpoint: user.notifications.channels.email.endpoint,
      },
    } as PersonalNotification);
  }

  if (user.notifications.channels.telegram?.isEnabled) {
    sendTo(WorkerPaths.Telegram, {
      type: task.type,
      payload: {
        ...task.payload,
        endpoint: user.notifications.channels.telegram.endpoint,
      },
    } as PersonalNotification);
  }

  if (user.notifications.channels.slack?.isEnabled) {
    sendTo(WorkerPaths.Slack, {
      type: task.type,
      payload: {
        ...task.payload,
        endpoint: user.notifications.channels.slack.endpoint,
      },
    } as PersonalNotification);
  }
}