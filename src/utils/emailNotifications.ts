import { SenderWorkerTasks } from '../types/userNotifications';
import { enqueue, WorkerPaths } from '../rabbitmq';
import { Options } from 'amqplib';

export enum TaskPriorities {
  PRIMARY = 1,
  IMPORTANT = 5,
}

/**
 * Send email notification
 *
 * @param task - payload with email and other data for the notification
 * @param options - rabbitmq options
 */
export async function emailNotification(task: SenderWorkerTasks, options?: Options.Publish): Promise<void> {
  enqueue(WorkerPaths.Email, task, options);
}
