import { MongoClient } from 'mongodb';
import config from './config.js';

const accountsMongoDb = await MongoClient.connect(config.databases.mongodbAccountsUri);

export {
  accountsMongoDb
};
