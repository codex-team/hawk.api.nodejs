import { Db, MongoClient, MongoClientOptions } from 'mongodb';
import HawkCatcher from '@hawk.so/nodejs';

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
 * Mongo clients for Hawk database
 */
interface MongoClients {
  /**
   * Mongo client for Hawk database for users, workspaces, project, etc
   */
  hawk: MongoClient | null;

  /**
   * Mongo client for events database
   */
  events: MongoClient | null;
}

/**
 * Export mongo clients
 */
export const mongoClients: MongoClients = {
  hawk: null,
  events: null,
};

/**
 * Common params for all connections
 */
const connectionConfig: MongoClientOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

/**
 * Setups connections to the databases (hawk api and events databases)
 */
export async function setupConnections(): Promise<void> {
  let eventsMongoClient = null;
  let hawkMongoClient = null;

  /**
   * Connect to hawk database
   * Throws error if API can't connect to db
   */
  try {
    hawkMongoClient = await MongoClient.connect(hawkDBUrl, connectionConfig);
    mongoClients.hawk = hawkMongoClient;
    databases.hawk = hawkMongoClient.db();
  } catch (e) {
    /** Catch start Mongo errors  */
    HawkCatcher.send(e);
    throw e;
  }

  /**
   * Connect to hawk events database
   * Log error, but don't throw it
   */
  try {
    eventsMongoClient = await MongoClient.connect(eventsDBUrl, connectionConfig);
    mongoClients.events = eventsMongoClient;
    databases.events = eventsMongoClient.db();
  } catch (e) {
    HawkCatcher.send(e);
    console.log(e);
  }
}

/**
 * Makes '_id' field optional on type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OptionalId<TSchema> = Omit<TSchema, '_id'> & { _id?: any };
