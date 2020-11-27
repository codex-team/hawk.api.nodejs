import bgTasks from './bgTasks';
import { WorkerTypes } from './types/bgTasks';
import { UserDBScheme } from './models/user';

/**
 * Send personal notification to user email
 *
 * @param payload - data to send
 */
function sendEmail(payload: string): void {
  console.log('SASKE');
  bgTasks.enqueue(WorkerTypes.Email, payload);
}

/**
 * Send personal notification to user telegram
 *
 * @param payload - data to send
 */
function sendToTelegram(payload: string): void {
  bgTasks.enqueue(WorkerTypes.Telegram, payload);
}

/**
 * Send personal notification to user slack
 *
 * @param payload - data to send
 */
function sendToSlack(payload: string): void {
  bgTasks.enqueue(WorkerTypes.Slack, payload);
}

export default {
  /**
   * Send notifications to all enable resources
   *
   * @param user - user data
   * @param payload - stringified data to send
   */
  sendNotifications(user: UserDBScheme, payload: string): void {
    if (!user.notifications) {
      return;
    }

    if (user.notifications.channels.email?.isEnabled) {
      sendEmail(payload);
    }

    if (user.notifications.channels.telegram?.isEnabled) {
      sendToTelegram(payload);
    }

    if (user.notifications.channels.slack?.isEnabled) {
      sendToSlack(payload);
    }
  },
};