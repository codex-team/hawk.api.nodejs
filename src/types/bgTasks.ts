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

export interface WorkerType {
  exchange: string;
  queue: string;
}

/**
 * Worker Type
 */
export const WorkerTypes: { [key: string]: WorkerType } = {
  Merchant: {
    exchange: Exchanges.Merchant,
    queue: Queues.Merchant,
  },
  Email: {
    exchange: Exchanges.Empty,
    queue: Queues.Email,
  },
  Telegram: {
    exchange: Exchanges.Notify,
    queue: Queues.Telegram,
  },
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
   * Use who assigned person to resolve an issue
   */
  whoAssignedId: string;

  /**
   * Id of the event
   */
  eventId: string;
}

/**
 * All task payloads
 */
export type AllPayloads = PersonalNotificationPayload