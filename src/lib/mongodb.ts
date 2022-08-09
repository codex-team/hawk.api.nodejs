import { MongoClient } from 'mongodb';
import config from './config.js';
import { getLogger } from './logger.js';

let accountsMongoDb: MongoClient;

const databaseLogger = getLogger('database');

try {
  databaseLogger.info('Connecting to MongoDB accounts database');
  accountsMongoDb = await MongoClient.connect(config.databases.mongodbAccountsUri);
  databaseLogger.info('Connected to MongoDB accounts database');
} catch (err) {
  databaseLogger.error({ err }, 'Failed to connect to MongoDB accounts database');
}

export {
  accountsMongoDb
};
