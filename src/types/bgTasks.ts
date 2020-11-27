/**
 * Contains rabbitmq exchanges and queues
 */

/**
 * Rabbitmq exchanges
 */
export enum Exchanges {
  Errors='errors',
  Notify='notify',
  Stash='stash',
  Merchant='merchant',
  Empty=''
}

/**
 * Rabbitmq queues
 */
export enum Queues {
  Merchant='merchant/initialized',
  Email='sender/email',
  Telegram='notify/telegram',
  Slack='notify/slack'
}

export interface WorkerType {
  exchange: string;
  queue: string;
}

/**
 * Worker Type
 */
export const WorkerTypes: {[key: string]: WorkerType} = {
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