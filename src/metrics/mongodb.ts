import client from 'prom-client';
import { MongoClient, MongoClientOptions } from 'mongodb';

/**
 * MongoDB command duration histogram
 * Tracks MongoDB command duration by command, collection, and database
 */
export const mongoCommandDuration = new client.Histogram({
  name: 'hawk_mongo_command_duration_seconds',
  help: 'Histogram of MongoDB command duration by command, collection, and db',
  labelNames: ['command', 'collection', 'db'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
});

/**
 * MongoDB command errors counter
 * Tracks failed MongoDB commands grouped by command and error code
 */
export const mongoCommandErrors = new client.Counter({
  name: 'hawk_mongo_command_errors_total',
  help: 'Counter of failed MongoDB commands grouped by command and error code',
  labelNames: ['command', 'error_code'],
});

/**
 * Enhance MongoClient options with monitoring
 * @param options - Original MongoDB connection options
 * @returns Enhanced options with monitoring enabled
 */
export function withMongoMetrics(options: MongoClientOptions = {}): MongoClientOptions {
  return {
    ...options,
    monitorCommands: true,
  };
}

/**
 * Setup MongoDB metrics monitoring on a MongoClient
 * @param client - MongoDB client to monitor
 */
export function setupMongoMetrics(client: MongoClient): void {
  client.on('commandStarted', (event) => {
    // Store start time for this command
    const startTimeKey = `${event.requestId}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)[startTimeKey] = Date.now();
  });

  client.on('commandSucceeded', (event) => {
    const startTimeKey = `${event.requestId}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const startTime = (client as any)[startTimeKey];

    if (startTime) {
      const duration = (Date.now() - startTime) / 1000;

      /**
       * Extract collection name from the command
       * For most commands, the collection name is the value of the command name key
       * e.g., { find: "users" } -> collection is "users"
       */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const collection = event.command ? ((event.command as any)[event.commandName] || 'unknown') : 'unknown';
      const db = event.databaseName || 'unknown';

      mongoCommandDuration
        .labels(event.commandName, collection, db)
        .observe(duration);

      // Clean up start time
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (client as any)[startTimeKey];
    }
  });

  client.on('commandFailed', (event) => {
    const startTimeKey = `${event.requestId}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const startTime = (client as any)[startTimeKey];

    if (startTime) {
      const duration = (Date.now() - startTime) / 1000;

      /**
       * Extract collection name from the command
       * For most commands, the collection name is the value of the command name key
       * e.g., { find: "users" } -> collection is "users"
       */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const collection = event.command ? ((event.command as any)[event.commandName] || 'unknown') : 'unknown';
      const db = event.databaseName || 'unknown';

      mongoCommandDuration
        .labels(event.commandName, collection, db)
        .observe(duration);

      // Track error
      const errorCode = event.failure?.code?.toString() || 'unknown';

      mongoCommandErrors
        .labels(event.commandName, errorCode)
        .inc();

      // Clean up start time
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (client as any)[startTimeKey];
    }
  });
}
