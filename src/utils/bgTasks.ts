import { WorkerPath, SenderWorkerTask, BgTaskPayload } from '../types/bgTasks';
import * as rabbitmq from '../rabbitmq';

/**
 * Performs tasks in the background
 */
export default class BgTasks {
  /**
   * Put a background task into the queue on rabbitmq
   *
   * @param workerPath - worker rabbitmq path: exchange and queue
   * @param payload - anything that we can stringify
   */
  public enqueue<T extends BgTaskPayload>(workerPath: WorkerPath, task: SenderWorkerTask<T>): void {
    rabbitmq.publish(workerPath.exchange, workerPath.queue, JSON.stringify(task.payload));
  }
}