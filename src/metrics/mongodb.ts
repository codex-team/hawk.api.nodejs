import promClient from 'prom-client';
import { MongoClient, MongoClientOptions } from 'mongodb';

/**
 * MongoDB command duration histogram
 * Tracks MongoDB command duration by command, collection family, and database
 */
export const mongoCommandDuration = new promClient.Histogram({
  name: 'hawk_mongo_command_duration_seconds',
  help: 'Histogram of MongoDB command duration by command, collection family, and db',
  labelNames: ['command', 'collection_family', 'db'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
});

/**
 * MongoDB command errors counter
 * Tracks failed MongoDB commands grouped by command and error code
 */
export const mongoCommandErrors = new promClient.Counter({
  name: 'hawk_mongo_command_errors_total',
  help: 'Counter of failed MongoDB commands grouped by command and error code',
  labelNames: ['command', 'error_code'],
});

/**
 * Extract collection family from full collection name
 * Reduces cardinality by grouping dynamic collections
 * @param collectionName - Full collection name (e.g., "events:projectId")
 * @returns Collection family (e.g., "events")
 */
function getCollectionFamily(collectionName: string): string {
  if (collectionName === 'unknown') {
    return 'unknown';
  }

  // Extract prefix before colon for dynamic collections
  const colonIndex = collectionName.indexOf(':');

  if (colonIndex > 0) {
    return collectionName.substring(0, colonIndex);
  }

  return collectionName;
}

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
    // Store start time and metadata for this command
    const metadataKey = `${event.requestId}`;

    // Extract collection name from the command
    const collection = event.command ? ((event.command)[event.commandName] || 'unknown') : 'unknown';
    const collectionFamily = getCollectionFamily(collection);
    const db = event.databaseName || 'unknown';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)[metadataKey] = {
      startTime: Date.now(),
      collectionFamily,
      db,
      commandName: event.commandName,
    };
  });

  client.on('commandSucceeded', (event) => {
    const metadataKey = `${event.requestId}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = (client as any)[metadataKey];

    if (metadata) {
      const duration = (Date.now() - metadata.startTime) / 1000;

      mongoCommandDuration
        .labels(metadata.commandName, metadata.collectionFamily, metadata.db)
        .observe(duration);

      // Clean up metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (client as any)[metadataKey];
    }
  });

  client.on('commandFailed', (event) => {
    const metadataKey = `${event.requestId}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = (client as any)[metadataKey];

    if (metadata) {
      const duration = (Date.now() - metadata.startTime) / 1000;

      mongoCommandDuration
        .labels(metadata.commandName, metadata.collectionFamily, metadata.db)
        .observe(duration);

      // Track error
      const errorCode = event.failure?.code?.toString() || 'unknown';

      mongoCommandErrors
        .labels(metadata.commandName, errorCode)
        .inc();

      // Clean up metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (client as any)[metadataKey];
    }
  });
}
