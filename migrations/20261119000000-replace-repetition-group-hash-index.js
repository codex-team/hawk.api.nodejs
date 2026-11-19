const { MongoClient } = require('mongodb');

const NEW_REPETITIONS_INDEX_NAME = 'groupHashAndId';
const OLD_REPETITIONS_INDEX_NAME = 'groupHash_hashed';

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
 * @returns {Promise<void>}
 */
async function dropIndexIfExists(collection, indexName) {
  await collection.dropIndex(indexName).catch((error) => {
    if (error.codeName !== 'IndexNotFound') {
      throw error;
    }
  });
}

module.exports = {
  async up() {
    await withEventsDatabase(async (db) => {
      const collections = await db.listCollections({ name: /^repetitions:/ }, { nameOnly: true }).toArray();

      for (const { name } of collections) {
        const collection = db.collection(name);

        /**
         * Create the compound B-tree index before dropping the hashed one so groupHash queries stay indexed.
         */
        await collection.createIndex({
          groupHash: 1,
          _id: -1,
        }, {
          name: NEW_REPETITIONS_INDEX_NAME,
        });

        await dropIndexIfExists(collection, OLD_REPETITIONS_INDEX_NAME);
      }
    });
  },

  async down() {
    await withEventsDatabase(async (db) => {
      const collections = await db.listCollections({ name: /^repetitions:/ }, { nameOnly: true }).toArray();

      for (const { name } of collections) {
        const collection = db.collection(name);

        await collection.createIndex({
          groupHash: 'hashed',
        }, {
          name: OLD_REPETITIONS_INDEX_NAME,
        });

        await dropIndexIfExists(collection, NEW_REPETITIONS_INDEX_NAME);
      }
    });
  },
};
