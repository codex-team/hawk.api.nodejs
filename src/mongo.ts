import { Db, MongoClient, MongoClientOptions } from 'mongodb';

const hawkDBUrl = process.env.MONGO_HAWK_DB_URL || 'mongodb://localhost:27017/hawk';
const eventsDBUrl = process.env.MONGO_EVENTS_DB_URL || 'mongodb://localhost:27017/events';

/**
 * Connections to Hawk databases
 */
interface Databases {
  /**
   * Hawk database for users, workspaces, project, etc
   */
  hawk: Db | null;

  /**
   * Events database
   */
  events: Db | null;
}

/**
 * Exported database connections
 */
export const databases: Databases = {
  hawk: null,
  events: null,
};

/**
 * Common params for all connections
 */
const connectionConfig: MongoClientOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  reconnectTries: +(process.env.MONGO_RECONNECT_TRIES || 60),
  reconnectInterval: +(process.env.MONGO_RECONNECT_INTERVAL || 1000),
  autoReconnect: true,
};

/**
 * Setups connections to the databases (hawk api and events databases)
 */
export async function setupConnections(): Promise<void> {
  const [hawkDB, eventsDB] = (await Promise.all([
    MongoClient.connect(hawkDBUrl, connectionConfig),
    MongoClient.connect(eventsDBUrl, connectionConfig),
  ])).map(client => client.db());

  databases.hawk = hawkDB;
  databases.events = eventsDB;
}

/**
 * Makes '_id' field optional on type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OptionalId<TSchema> = Omit<TSchema, '_id'> & { _id?: any };
