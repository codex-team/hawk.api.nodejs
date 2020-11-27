import { WorkerType } from './types/bgTasks';
import * as rabbitmq from './rabbitmq';

export default {
  /**
   * Put a background task into the queue on rabbitmq
   *
   * @param workerType - worker settings: exchange and queue
   * @param payload - anything that we can stringify
   */
  enqueue(workerType: WorkerType, payload: string): void {
    console.log('PUSH', workerType, payload);
    rabbitmq.publish(workerType.exchange, workerType.queue, payload);
  },
};