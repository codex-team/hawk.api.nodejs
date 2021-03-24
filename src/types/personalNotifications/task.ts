import { SenderWorkerTaskType } from './task-type';

/**
 * Common payload for sender worker tasks
 */
export interface SenderWorkerPayload {
  /**
   * Endpoint to send notifications to
   */
  endpoint?: string;
}

/**
 * Task shape for sender worker
 */
export interface SenderWorkerTask<Payload extends SenderWorkerPayload> {
  /**
   * Type of task
   */
  type: SenderWorkerTaskType;

  /**
   * Payload of task
   */
  payload: Payload;
}
