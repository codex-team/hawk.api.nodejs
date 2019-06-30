const mongo = require('mongodb').MongoClient;

const hawkDBUrl = process.env.MONGO_HAWK_DB_URL || 'mongodb://localhost:27017/hawk';
const eventsDBUrl = process.env.MONGO_EVENTS_DB_URL || 'mongodb://localhost:27017/events';

const databases = {
  hawk: null,
  events: null
};

const connectionConfig = {
  useNewUrlParser: true
};

/**
 * Setups connections to the databases (common hawk and events databases)
 * @return {Promise<void>}
 */
async function setupConnections() {
  const hawkConnection = new Promise((resolve, reject) => {
    mongo.connect(hawkDBUrl, connectionConfig, (err, db) => {
      if (err) return reject(err);
      resolve(db.db());
    });
  });

  const eventsConnection = new Promise((resolve, reject) => {
    mongo.connect(eventsDBUrl, connectionConfig, (err, db) => {
      if (err) return reject(err);
      resolve(db.db());
    });
  });

  const [hawkDB, eventsDB] = await Promise.all([hawkConnection, eventsConnection]);

  databases.hawk = hawkDB;
  databases.events = eventsDB;
}

module.exports = {
  setupConnections,
  databases
};
