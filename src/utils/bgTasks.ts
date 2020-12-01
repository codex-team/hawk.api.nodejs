import { WorkerType } from '../types/bgTasks';
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
  public enqueue(workerType: WorkerType, payload: string): void {
    rabbitmq.publish(workerType.exchange, workerType.queue, payload);
  }
}