import { WorkerPath, SenderWorkerTask, BgTask } from '../types/bgTasks';
import * as rabbitmq from '../rabbitmq';

/**
 * Performs tasks in the background
 */
export default class BgTasks {
  /**
   * Put a background task into the queue on rabbitmq
   *
   * @param workerPath - worker rabbitmq path: exchange and queue
   * @param task - anything that we can stringify
   */
  public enqueue<T extends BgTask>(workerPath: WorkerPath, task: T): void {
    rabbitmq.publish(workerPath.exchange, workerPath.queue, JSON.stringify(task));
  }
}