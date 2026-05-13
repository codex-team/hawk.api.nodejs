import { Db, MongoClient, MongoClientOptions } from 'mongodb';
import HawkCatcher from '@hawk.so/nodejs';
import { setupMongoMetrics, withMongoMetrics } from './metrics';

const hawkDBUrl = process.env.MONGO_HAWK_DB_URL || 'mongodb://localhost:27017/hawk';
const eventsDBUrl = process.env.MONGO_EVENTS_DB_URL || 'mongodb://localhost:27017/events';

const reconnectTries = Number(process.env.MONGO_RECONNECT_TRIES) || 60;
const reconnectInterval = Number(process.env.MONGO_RECONNECT_INTERVAL) || 1000;

/**
 * serverSelectionTimeoutMS bounds how long an op waits for an available
 * server — without it queries hang forever during an outage.
 */
const connectionConfig: MongoClientOptions = withMongoMetrics({
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  retryReads: true,
});

/**
 * Connections to Hawk databases
 */
interface Databases {
  /**
   * Hawk database for users, workspaces, project, etc
   */
  hawk: Db | null;

  /**
   * Events database
   */
  events: Db | null;
}

/**
 * Exported database connections
 */
export const databases: Databases = {
  hawk: null,
  events: null,
};

/**
 * Mongo clients for Hawk database
 */
interface MongoClients {
  /**
   * Mongo client for Hawk database for users, workspaces, project, etc
   */
  hawk: MongoClient | null;

  /**
   * Mongo client for events database
   */
  events: MongoClient | null;
}

/**
 * Export mongo clients
 */
export const mongoClients: MongoClients = {
  hawk: null,
  events: null,
};

/**
 * Connects to the given URL, retrying with a fixed interval up to
 * MONGO_RECONNECT_TRIES times before giving up.
 *
 * @param name - logical name for logging
 * @param url - MongoDB connection string
 * @returns connected client
 */
async function connectWithRetry(name: string, url: string): Promise<MongoClient> {
  for (let attempt = 1; attempt <= reconnectTries; attempt++) {
    const client = new MongoClient(url, connectionConfig);

    try {
      await client.connect();
      console.log(`[Mongo:${name}] connected`);

      return client;
    } catch (err) {
      await client.close().catch(() => undefined);

      const message = (err as Error)?.message ?? String(err);

      if (attempt === reconnectTries) {
        throw new Error(`[Mongo:${name}] failed after ${reconnectTries} attempts: ${message}`);
      }
      console.warn(`[Mongo:${name}] attempt ${attempt}/${reconnectTries} failed: ${message}`);
      await new Promise((resolve) => setTimeout(resolve, reconnectInterval));
    }
  }

  throw new Error(`[Mongo:${name}] unreachable`);
}

/**
 * Logs and reports heartbeat failures / recoveries once per transition.
 *
 * @param name - logical name for logging
 * @param client - connected client to observe
 */
function watchConnection(name: string, client: MongoClient): void {
  let healthy = true;

  client.on('serverHeartbeatFailed', (event) => {
    if (!healthy) {
      return;
    }
    healthy = false;
    const message = (event.failure as Error)?.message ?? 'heartbeat failed';

    console.error(`[Mongo:${name}] connection lost: ${message}`);
    HawkCatcher.send(new Error(`MongoDB ${name} connection lost: ${message}`));
  });

  client.on('serverHeartbeatSucceeded', () => {
    if (healthy) {
      return;
    }
    healthy = true;
    console.log(`[Mongo:${name}] connection recovered`);
  });
}

/**
 * Connects to both databases with bounded retry. The driver auto-recovers
 * from transient failures on already-open clients, so retries here cover
 * the initial handshake only.
 *
 * @returns promise resolved when both clients are connected
 */
export async function setupConnections(): Promise<void> {
  try {
    const [hawkClient, eventsClient] = await Promise.all([
      connectWithRetry('hawk', hawkDBUrl),
      connectWithRetry('events', eventsDBUrl),
    ]);

    mongoClients.hawk = hawkClient;
    mongoClients.events = eventsClient;
    databases.hawk = hawkClient.db();
    databases.events = eventsClient.db();

    /**
     * Log and measure MongoDB metrics, then observe heartbeats for outage logs
     */
    setupMongoMetrics(hawkClient);
    setupMongoMetrics(eventsClient);
    watchConnection('hawk', hawkClient);
    watchConnection('events', eventsClient);
  } catch (e) {
    /** Catch start Mongo errors  */
    HawkCatcher.send(e as Error);
    throw e;
  }
}

/**
 * Closes both clients. Call from SIGTERM/SIGINT for graceful shutdown.
 *
 * @returns promise resolved once both clients are closed
 */
export async function closeConnections(): Promise<void> {
  await Promise.allSettled([
    mongoClients.hawk?.close(),
    mongoClients.events?.close(),
  ]);

  mongoClients.hawk = null;
  mongoClients.events = null;
  databases.hawk = null;
  databases.events = null;
}

/**
 * Makes '_id' field optional on type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OptionalId<TSchema> = Omit<TSchema, '_id'> & { _id?: any };
