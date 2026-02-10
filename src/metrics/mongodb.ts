import promClient from 'prom-client';
import { MongoClient, MongoClientOptions } from 'mongodb';
import { Effect, sgr } from '../utils/ansi';
import HawkCatcher from '@hawk.so/nodejs';

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
 * Colorize duration based on performance thresholds
 * @param duration - Duration in milliseconds
 * @returns Colorized duration string
 */
function colorizeDuration(duration: number): string {
  let color: Effect;

  if (duration < 50) {
    color = Effect.ForegroundGreen;
  } else if (duration < 100) {
    color = Effect.ForegroundYellow;
  } else {
    color = Effect.ForegroundRed;
  }

  return sgr(`${duration}ms`, color);
}

/**
 * Interface for storing command information with timestamp
 */
interface StoredCommandInfo {
  formattedCommand: string;
  timestamp: number;
}

/**
 * Map to store formatted command information by requestId
 */
const commandInfoMap = new Map<number, StoredCommandInfo>();

/**
 * Timeout for cleaning up stale command info (30 seconds)
 */
const COMMAND_INFO_TIMEOUT_MS = 30000;

/**
 * Cleanup stale command info to prevent memory leaks
 * Removes entries older than COMMAND_INFO_TIMEOUT_MS
 */
function cleanupStaleCommandInfo(): void {
  const now = Date.now();
  const keysToDelete: number[] = [];

  for (const [requestId, info] of commandInfoMap.entries()) {
    if (now - info.timestamp > COMMAND_INFO_TIMEOUT_MS) {
      keysToDelete.push(requestId);
    }
  }

  if (keysToDelete.length > 0) {
    console.warn(`Cleaning up ${keysToDelete.length} stale MongoDB command info entries (possible memory leak)`);
    for (const key of keysToDelete) {
      commandInfoMap.delete(key);
    }
  }
}

/**
 * Periodic cleanup interval
 */
setInterval(cleanupStaleCommandInfo, COMMAND_INFO_TIMEOUT_MS);

/**
 * Store MongoDB command details for later logging
 * @param event - MongoDB command event
 */
function storeCommandInfo(event: any): void {
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
  const projectionStr = projection ? ` projection: ${formatParams(projection)}` : '';

  const formattedCommand = `[${event.requestId}] ${db}.${collection}.${commandName}(${paramsStr})${projectionStr}`;

  commandInfoMap.set(event.requestId, {
    formattedCommand,
    timestamp: Date.now(),
  });
}

/**
 * Log MongoDB command success to console
 * Format: [requestId] db.collection.command(params) ✓ duration
 * @param event - MongoDB command event
 */
function logCommandSucceeded(event: any): void {
  const info = commandInfoMap.get(event.requestId);
  const durationStr = colorizeDuration(event.duration);

  if (info) {
    console.log(`${info.formattedCommand} ✓ ${durationStr}`);
    commandInfoMap.delete(event.requestId);
  } else {
    console.log(`[${event.requestId}] ${event.commandName} ✓ ${durationStr}`);
  }
}

/**
 * Log MongoDB command failure to console
 * Format: [requestId] db.collection.command(params) ✗ error duration
 * @param event - MongoDB command event
 */
function logCommandFailed(event: any): void {
  const errorMsg = event.failure?.message || event.failure?.errmsg || 'Unknown error';
  const info = commandInfoMap.get(event.requestId);
  const durationStr = colorizeDuration(event.duration);

  if (info) {
    console.error(`${info.formattedCommand} ✗ ${errorMsg} ${durationStr}`);
    commandInfoMap.delete(event.requestId);
  } else {
    console.error(`[${event.requestId}] ${event.commandName} ✗ ${errorMsg} ${durationStr}`);
  }
}

/**
 * Setup MongoDB metrics monitoring on a MongoClient
 * @param client - MongoDB client to monitor
 */
export function setupMongoMetrics(client: MongoClient): void {
  /**
   * Skip setup in test environment
   */
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.NODE_ENV === 'e2e'
  ) {
    return;
  }

  client.on('commandStarted', (event) => {
    storeCommandInfo(event);

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

      HawkCatcher.breadcrumbs.add({
        type: 'request',
        category: 'db.query',
        message: `${metadata.db}.${metadata.collectionFamily}.${metadata.commandName} ${event.duration}ms`,
        level: 'debug',
        data: {
          db: metadata.db,
          collection: metadata.collectionFamily,
          command: metadata.commandName,
          durationMs: { value: event.duration },
        },
      });

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
      /**
       * MongoDB failure objects may have additional properties like 'code'
       * that aren't part of the standard Error type
       */
      const errorCode = (event.failure as any)?.code?.toString() || 'unknown';

      mongoCommandErrors
        .labels(metadata.commandName, errorCode)
        .inc();

      const errorMsg = (event.failure as any)?.message || 'Unknown error';

      HawkCatcher.breadcrumbs.add({
        type: 'error',
        category: 'db.query',
        message: `${metadata.db}.${metadata.collectionFamily}.${metadata.commandName} FAILED: ${errorMsg} ${event.duration}ms`,
        level: 'error',
        data: {
          db: metadata.db,
          collection: metadata.collectionFamily,
          command: metadata.commandName,
          durationMs: { value: event.duration },
          errorCode,
        },
      });

      // Clean up metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (client as any)[metadataKey];
    }
  });
}
