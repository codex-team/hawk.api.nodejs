import { ApolloError } from 'apollo-server-express';

/**
 * Hawk API error codes
 */
export const errorCodes = {
  /**
   * Auth-related error codes
   */
  AUTH_ACCESS_TOKEN_EXPIRED_ERROR: 'ACCESS_TOKEN_EXPIRED_ERROR',

  /**
   * MongoDB error codes
   */
  DB_DUPLICATE_KEY_ERROR: '11000',
};

/**
 * Class for non critical errors (expected errors that we don't want to log)
 * Events inherited from this class won't be send to hawk
 */
export class NonCriticalError extends ApolloError {}

/**
 * Error throws when user send expired access token and tries to access private resources
 */
export class AccessTokenExpiredError extends NonCriticalError {
  /**
   * Error constructor
   */
  constructor() {
    super('You need to refresh your tokens', errorCodes.AUTH_ACCESS_TOKEN_EXPIRED_ERROR);
  }
}
