import {Db, MongoClient, MongoClientOptions} from 'mongodb';

const hawkDBUrl = process.env.MONGO_HAWK_DB_URL || 'mongodb://localhost:27017/hawk';
const eventsDBUrl = process.env.MONGO_EVENTS_DB_URL || 'mongodb://localhost:27017/events';

interface Databases {
  hawk: Db | null;
  events: Db | null;
}

export const databases: Databases = {
  hawk: null,
  events: null
};

const connectionConfig: MongoClientOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  reconnectTries: +(process.env.MONGO_RECONNECT_TRIES || 60),
  reconnectInterval: +(process.env.MONGO_RECONNECT_INTERVAL || 1000),
  autoReconnect: true
};

/**
 * Setups connections to the databases (hawk api and events databases)
 */
export async function setupConnections(): Promise<void> {
  const [hawkDB, eventsDB] = (await Promise.all([
    MongoClient.connect(hawkDBUrl, connectionConfig),
    MongoClient.connect(eventsDBUrl, connectionConfig)
  ])).map(client => client.db());

  databases.hawk = hawkDB;
  databases.events = eventsDB;
}
