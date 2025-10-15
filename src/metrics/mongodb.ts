import promClient from 'prom-client';
import { MongoClient, MongoClientOptions } from 'mongodb';
import { Effect, sgr } from '../utils/ansi';

/**
 * MongoDB command duration histogram
 * Tracks MongoDB command duration by command, collection family, and database
 */
export const mongoCommandDuration = new promClient.Histogram({
  name: 'hawk_mongo_command_duration_seconds',
  help: 'Histogram of MongoDB command duration by command, collection family, and db',
  labelNames: ['command', 'collection_family', 'db'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
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
 * Extract collection name from MongoDB command
 * Handles different command types and their collection name locations
 * @param command - MongoDB command object
 * @param commandName - Name of the command (find, insert, getMore, etc.)
 * @returns Raw collection identifier or null
 */
function extractCollectionFromCommand(command: any, commandName: string): unknown {
  if (!command) {
    return null;
  }

  // Special handling for getMore command - collection is in a different field
  if (commandName === 'getMore') {
    return command.collection || null;
  }

  /*
   * For most commands, collection name is the value of the command name key
   * e.g., { find: "users" } -> collection is "users"
   */
  return command[commandName] || null;
}

/**
 * Normalize collection value to string
 * Handles BSON types and other non-string values
 * @param collection - Collection value from MongoDB command
 * @returns Normalized string or 'unknown'
 */
function normalizeCollectionName(collection: unknown): string {
  if (!collection) {
    return 'unknown';
  }

  // Handle string values directly
  if (typeof collection === 'string') {
    return collection;
  }

  // Handle BSON types and objects with toString method
  if (typeof collection === 'object' && 'toString' in collection) {
    try {
      const str = String(collection);

      // Skip if toString returns object representation like [object Object]
      if (!str.startsWith('[object') && str !== 'unknown') {
        return str;
      }
    } catch (e) {
      console.error('Error normalizing collection name', e);
      // Ignore conversion errors
    }
  }

  return 'unknown';
}

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
 * Format filter/update parameters for logging
 * @param params - Parameters to format
 * @returns Formatted string
 */
function formatParams(params: any): string {
  if (!params || Object.keys(params).length === 0) {
    return '';
  }

  try {
    return JSON.stringify(params);
  } catch (e) {
    return String(params);
  }
}

/**
 * Log MongoDB command details to console
 * Format: [requestId] db.collection.command(params)
 * @param event - MongoDB command event
 */
function logCommandStarted(event: any): void {
  const collectionRaw = extractCollectionFromCommand(event.command, event.commandName);
  const collection = sgr(normalizeCollectionName(collectionRaw), Effect.ForegroundGreen);
  const db = event.databaseName || 'unknown db';
  const commandName = sgr(event.commandName, Effect.ForegroundRed);
  const filter = event.command.filter;
  const update = event.command.update;
  const pipeline = event.command.pipeline;
  const projection = event.command.projection;
  const params = filter || update || pipeline;
  const paramsStr = formatParams(params);

  console.log(`[${event.requestId}] ${db}.${collection}.${commandName}(${paramsStr}) ${projection ? `projection: ${formatParams(projection)}` : ''}`);
}

/**
 * Log MongoDB command success to console
 * Format: [requestId] commandName ✓ duration
 * @param event - MongoDB command event
 */
function logCommandSucceeded(event: any): void {
  console.log(`[${event.requestId}] ${event.commandName} ✓ ${event.duration}ms`);
}

/**
 * Log MongoDB command failure to console
 * Format: [requestId] ✗ error
 * @param event - MongoDB command event
 */
function logCommandFailed(event: any): void {
  const errorMsg = event.failure?.message || event.failure?.errmsg || 'Unknown error';

  console.error(`[${event.requestId}] ${event.commandName} ✗ ${errorMsg} (${event.duration}ms)`);
}

/**
 * Setup MongoDB metrics monitoring on a MongoClient
 * @param client - MongoDB client to monitor
 */
export function setupMongoMetrics(client: MongoClient): void {
  client.on('commandStarted', (event) => {
    logCommandStarted(event);

    // Store start time and metadata for this command
    const metadataKey = `${event.requestId}`;

    // Extract collection name from the command
    const collectionRaw = extractCollectionFromCommand(event.command, event.commandName);
    const collection = normalizeCollectionName(collectionRaw);
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
    logCommandSucceeded(event);

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
    logCommandFailed(event);

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
