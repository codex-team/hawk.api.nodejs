const { MongoClient } = require('mongodb');

const NEW_REPETITIONS_INDEX_NAME = 'groupHashAndId';
const OLD_REPETITIONS_INDEX_NAME = 'groupHash_hashed';

/**
 * Load ANSI formatting helpers from compiled JS when available (prod / built repo),
 * falling back to plain pass-through in unbuilt dev environments.
 *
 * @returns {{ Effect: object, sgr: Function }}
 */
function loadAnsi() {
  try {
    return require('../src/utils/ansi');
  } catch (_srcError) {
    try {
      return require('../build/src/utils/ansi');
    } catch (_buildError) {
      return {
        Effect: {},
        sgr: (message) => message,
      };
    }
  }
}

const { Effect, sgr } = loadAnsi();

const LOG_PREFIX = sgr('[migration:repetitions-index]', [Effect.ForegroundCyan, Effect.Bold]);

/**
 * Format duration in milliseconds into a human-readable string.
 *
 * @param {number} durationMs - elapsed time in milliseconds
 * @returns {string} formatted duration
 */
function formatDuration(durationMs) {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const seconds = durationMs / 1000;

  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toFixed(1);

  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format collection progress prefix, e.g. "[12/450 2.7%]".
 *
 * @param {number} index - zero-based collection index
 * @param {number} total - total collections count
 * @returns {string} formatted progress badge
 */
function formatProgress(index, total) {
  const current = index + 1;
  const percent = total > 0 ? ((current / total) * 100).toFixed(1) : '100.0';

  return sgr(`[${current}/${total} ${percent}%]`, Effect.ForegroundGray);
}

/**
 * Run an operation against the events database.
 *
 * @param {Function} callback - operation to run
 */
async function withEventsDatabase(callback) {
  const url = process.env.MONGO_EVENTS_DB_URL;

  if (!url) {
    throw new Error('MONGO_EVENTS_DB_URL must be set to migrate repetition indexes');
  }

  const client = new MongoClient(url);

  try {
    await client.connect();

    return await callback(client.db());
  } finally {
    await client.close();
  }
}

/**
 * Drop an index if it exists, ignoring IndexNotFound errors.
 *
 * @param {object} collection - MongoDB collection
 * @param {string} indexName - name of the index to drop
 * @returns {Promise<boolean>} true if dropped, false if index did not exist
 */
async function dropIndexIfExists(collection, indexName) {
  try {
    await collection.dropIndex(indexName);

    return true;
  } catch (error) {
    if (error.codeName !== 'IndexNotFound') {
      throw error;
    }

    return false;
  }
}

module.exports = {
  async up() {
    await withEventsDatabase(async (db) => {
      const startedAt = Date.now();
      const collections = await db.listCollections({ name: /^repetitions:/ }, { nameOnly: true }).toArray();
      const total = collections.length;
      let droppedCount = 0;

      console.log(
        `${LOG_PREFIX} Starting ${sgr('UP', [Effect.ForegroundGreen, Effect.Bold])}: ` +
        `found ${sgr(String(total), Effect.ForegroundYellow)} repetitions collections`
      );

      for (let i = 0; i < total; i++) {
        const { name } = collections[i];
        const collection = db.collection(name);
        const progress = formatProgress(i, total);
        const collectionLabel = sgr(name, Effect.ForegroundGreen);
        const collectionStartedAt = Date.now();

        console.log(
          `${LOG_PREFIX} ${progress} ${collectionLabel} — creating ${sgr(NEW_REPETITIONS_INDEX_NAME, Effect.ForegroundCyan)}...`
        );

        /**
         * Create the compound B-tree index before dropping the hashed one so groupHash queries stay indexed.
         */
        await collection.createIndex({
          groupHash: 1,
          _id: -1,
        }, {
          name: NEW_REPETITIONS_INDEX_NAME,
        });

        const wasDropped = await dropIndexIfExists(collection, OLD_REPETITIONS_INDEX_NAME);

        if (wasDropped) {
          droppedCount += 1;
        }

        const dropStatus = wasDropped
          ? `dropped ${sgr(OLD_REPETITIONS_INDEX_NAME, Effect.ForegroundYellow)}`
          : sgr(`${OLD_REPETITIONS_INDEX_NAME} not found`, Effect.ForegroundGray);
        const elapsed = sgr(formatDuration(Date.now() - collectionStartedAt), Effect.ForegroundGray);

        console.log(`${LOG_PREFIX} ${progress} ${collectionLabel} — done (${dropStatus}) in ${elapsed}`);
      }

      const totalElapsed = sgr(formatDuration(Date.now() - startedAt), Effect.ForegroundCyan);

      console.log(
        `${LOG_PREFIX} ${sgr('Finished UP', [Effect.ForegroundGreen, Effect.Bold])}: ` +
        `processed ${sgr(String(total), Effect.ForegroundYellow)} collections, ` +
        `dropped ${sgr(String(droppedCount), Effect.ForegroundYellow)} old indexes in ${totalElapsed}`
      );
    });
  },

  async down() {
    await withEventsDatabase(async (db) => {
      const startedAt = Date.now();
      const collections = await db.listCollections({ name: /^repetitions:/ }, { nameOnly: true }).toArray();
      const total = collections.length;
      let droppedCount = 0;

      console.log(
        `${LOG_PREFIX} Starting ${sgr('DOWN', [Effect.ForegroundYellow, Effect.Bold])}: ` +
        `found ${sgr(String(total), Effect.ForegroundYellow)} repetitions collections`
      );

      for (let i = 0; i < total; i++) {
        const { name } = collections[i];
        const collection = db.collection(name);
        const progress = formatProgress(i, total);
        const collectionLabel = sgr(name, Effect.ForegroundGreen);
        const collectionStartedAt = Date.now();

        console.log(
          `${LOG_PREFIX} ${progress} ${collectionLabel} — restoring ${sgr(OLD_REPETITIONS_INDEX_NAME, Effect.ForegroundCyan)}...`
        );

        await collection.createIndex({
          groupHash: 'hashed',
        }, {
          name: OLD_REPETITIONS_INDEX_NAME,
        });

        const wasDropped = await dropIndexIfExists(collection, NEW_REPETITIONS_INDEX_NAME);

        if (wasDropped) {
          droppedCount += 1;
        }

        const dropStatus = wasDropped
          ? `dropped ${sgr(NEW_REPETITIONS_INDEX_NAME, Effect.ForegroundYellow)}`
          : sgr(`${NEW_REPETITIONS_INDEX_NAME} not found`, Effect.ForegroundGray);
        const elapsed = sgr(formatDuration(Date.now() - collectionStartedAt), Effect.ForegroundGray);

        console.log(`${LOG_PREFIX} ${progress} ${collectionLabel} — done (${dropStatus}) in ${elapsed}`);
      }

      const totalElapsed = sgr(formatDuration(Date.now() - startedAt), Effect.ForegroundCyan);

      console.log(
        `${LOG_PREFIX} ${sgr('Finished DOWN', [Effect.ForegroundYellow, Effect.Bold])}: ` +
        `processed ${sgr(String(total), Effect.ForegroundYellow)} collections, ` +
        `dropped ${sgr(String(droppedCount), Effect.ForegroundYellow)} indexes in ${totalElapsed}`
      );
    });
  },
};
