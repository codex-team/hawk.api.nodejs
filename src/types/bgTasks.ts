/**
 * Contains rabbitmq exchanges and queues
 */

/**
 * Rabbitmq exchanges
 */
export enum Exchanges {
  Errors = 'errors',
  Notify = 'notify',
  Stash = 'stash',
  Merchant = 'merchant',
  Empty = ''
}

/**
 * Rabbitmq queues
 */
export enum Queues {
  Merchant = 'merchant/initialized',
  Email = 'sender/email',
  Telegram = 'notify/telegram',
  Slack = 'notify/slack'
}

/**
 * Contains a rabbitmq exchange and a queue for the worker
 */
export interface WorkerPath {
  /**
   * Rabbitmq exchange
   */
  exchange: string;

  /**
   * Rabbitmq queue
   */
  queue: string;
}

/**
 * Paths for workers to send events to the queue
 */
export const WorkerPaths: { [key: string]: WorkerPath } = {
  /**
   * Path to merchant worker
   */
  Merchant: {
    exchange: Exchanges.Merchant,
    queue: Queues.Merchant,
  },

  /**
   * Path to email worker
   */
  Email: {
    exchange: Exchanges.Empty,
    queue: Queues.Email,
  },

  /**
   * Path to telegram worker
   */
  Telegram: {
    exchange: Exchanges.Notify,
    queue: Queues.Telegram,
  },

  /**
   * Path to slack worker
   */
  Slack: {
    exchange: Exchanges.Notify,
    queue: Queues.Slack,
  },
};

/**
 * Universal interface to type tasks
 */
export interface SenderWorkerTask<Payload> {
  /**
   * Payload of task
   */
  payload: Payload;
}

export interface PersonalNotificationPayload {
  /**
   * ID of the user assigned to this event
   */
  assigneeId: string;

  /**
   * Project of the event
   */
  projectId: string;

  /**
   * Id of the user who has assigned a person to resolve the issue
   */
  whoAssignedId: string;

  /**
   * Id of the event
   */
  eventId: string;

  /**
   * Notification endpoint
   */
  endpoint?: string;
}

/**
 * All task payloads
 */
export type BgTaskPayload = PersonalNotificationPayload