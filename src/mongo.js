const mongo = require('mongodb').MongoClient;

const hawkDBUrl = process.env.MONGO_HAWK_DB_URL || 'mongodb://localhost:27017/hawk';
const eventsDBUrl = process.env.MONGO_EVENTS_DB_URL || 'mongodb://localhost:27017/events';

const databases = {
  hawk: null,
  events: null
};

const connectionConfig = {
  useNewUrlParser: true,
  reconnectTries: process.env.MONGO_RECONNECT_TRIES || 60,
  reconnectInterval: process.env.MONGO_RECONNECT_INTERVAL || 1000,
  autoReconnect: true
};

/**
 * Setups connections to the databases (hawk api and events databases)
 * @return {Promise<void>}
 */
async function setupConnections() {
  const [hawkDB, eventsDB] = (await Promise.all([
    mongo.connect(hawkDBUrl, connectionConfig),
    mongo.connect(eventsDBUrl, connectionConfig)
  ])).map(client => client.db());

  databases.hawk = hawkDB;
  databases.events = eventsDB;
}

module.exports = {
  setupConnections,
  databases
};
