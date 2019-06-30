const mongo = require('mongodb').MongoClient;

const hawkDBUrl = process.env.MONGO_HAWK_DB_URL || 'mongodb://localhost:27017/hawk';
const eventsDBUrl = process.env.MONGO_EVENTS_DB_URL || 'mongodb://localhost:27017/events';

let hawkDB = null;
let eventsDB = null;

/**
 * Setups connections to the databases (common hawk and events databases)
 * @return {Promise<void>}
 */
async function setupConnections() {
  const hawkConnection = new Promise((resolve, reject) => {
    mongo.connect(hawkDBUrl, (err, client) => {
      if (err) return reject(err);
      resolve(client);
    });
  });

  const eventsConnection = new Promise((resolve, reject) => {
    mongo.connect(eventsDBUrl, (err, client) => {
      if (err) return reject(err);
      resolve(client);
    });
  });

  [hawkDB, eventsDB] = await Promise.all([hawkConnection, eventsConnection]);
}

module.exports = {
  setupConnections,
  hawkDB,
  eventsDB
};
