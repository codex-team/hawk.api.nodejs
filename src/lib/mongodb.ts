import { MongoClient } from 'mongodb';
import { MONGODB_ACCOUNTS_URI } from './config.js';

const accountsMongoDb = await MongoClient.connect(MONGODB_ACCOUNTS_URI);

export {
  accountsMongoDb
};
