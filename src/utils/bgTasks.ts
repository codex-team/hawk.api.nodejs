import { WorkerType, SenderWorkerTask, AllPayloads } from '../types/bgTasks';
import * as rabbitmq from '../rabbitmq';

/**
 * Performs tasks in the background
 */
export default class BgTasks {
  /**
   * Put a background task into the queue on rabbitmq
   *
   * @param workerType - worker settings: exchange and queue
   * @param payload - anything that we can stringify
   */
  public enqueue<T extends AllPayloads>(workerType: WorkerType, task: SenderWorkerTask<T>): void {
    rabbitmq.publish(workerType.exchange, workerType.queue, JSON.stringify(task.payload));
  }
}