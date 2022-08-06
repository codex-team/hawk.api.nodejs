import { MongoClient } from 'mongodb';
import config from './config.js';
import logger from './logger.js';

let accountsMongoDb: MongoClient;

try {
  logger.info('Connecting to MongoDB accounts database');
  accountsMongoDb = await MongoClient.connect(config.databases.mongodbAccountsUri);
  logger.info('Connected to MongoDB accounts database');
} catch (err) {
  logger.error({ err }, 'Failed to connect to MongoDB accounts database');
}

export {
  accountsMongoDb
};
