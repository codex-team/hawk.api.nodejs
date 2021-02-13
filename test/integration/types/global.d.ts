// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { MongoClient } from 'mongodb';

/**
 * Defines global MongoDB client instance for using in tests
 */
declare global {
  namespace NodeJS {
    interface Global {
      mongoClient: MongoClient;
    }
  }
}
