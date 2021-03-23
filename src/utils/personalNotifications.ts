import { SenderWorkerTasks } from '../types/personalNotification';
import { UserDBScheme } from '../models/user';
import { enqueue, WorkerPaths } from '../rabbitmq';

/**
 * Send notification to all enable resources
 *
 * @param user - user data
 * @param task - data to send
 */
export default async function sendNotification(user: UserDBScheme, task: SenderWorkerTasks): Promise<void> {
  if (!user.notifications) {
    return;
  }

  if (user.notifications.channels.email?.isEnabled) {
    await enqueue(WorkerPaths.Email, {
      type: task.type,
      payload: {
        ...task.payload,
        endpoint: user.notifications.channels.email.endpoint,
      },
    });
  }

  if (user.notifications.channels.telegram?.isEnabled) {
    await enqueue(WorkerPaths.Telegram, {
      type: task.type,
      payload: {
        ...task.payload,
        endpoint: user.notifications.channels.telegram.endpoint,
      },
    });
  }

  if (user.notifications.channels.slack?.isEnabled) {
    await enqueue(WorkerPaths.Slack, {
      type: task.type,
      payload: {
        ...task.payload,
        endpoint: user.notifications.channels.slack.endpoint,
      },
    });
  }
}
