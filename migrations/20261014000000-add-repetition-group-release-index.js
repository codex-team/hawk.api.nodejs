const { MongoClient } = require('mongodb');

const REPETITIONS_INDEX_NAME = 'groupHashAndRelease';

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

module.exports = {
  async up() {
    await withEventsDatabase(async db => {
      const collections = await db.listCollections({ name: /^repetitions:/ }, { nameOnly: true }).toArray();

      for (const { name } of collections) {
        await db.collection(name).createIndex({
          groupHash: 1,
          release: 1,
        }, {
          name: REPETITIONS_INDEX_NAME,
        });
      }
    });
  },

  async down() {
    await withEventsDatabase(async db => {
      const collections = await db.listCollections({ name: /^repetitions:/ }, { nameOnly: true }).toArray();

      for (const { name } of collections) {
        await db.collection(name).dropIndex(REPETITIONS_INDEX_NAME)
          .catch(error => {
            if (error.codeName !== 'IndexNotFound' && error.code !== 27) {
              throw error;
            }
          });
      }
    });
  },
};
