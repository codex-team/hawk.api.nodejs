const { ApolloError } = require('apollo-server-express');

/**
 * Hawk API error codes
 */
const errorCodes = {
  /**
   * Auth-related error codes
   */
  AUTH_ACCESS_TOKEN_EXPIRED_ERROR: 'ACCESS_TOKEN_EXPIRED_ERROR',

  /**
   * MongoDB error codes
   */
  DB_DUPLICATE_KEY_ERROR: '11000'
};

/**
 * Error throws when user send expired access token and tries to access private resources
 */
class AccessTokenExpiredError extends ApolloError {
  /**
   * Error constructor
   */
  constructor() {
    super('You need to refresh your tokens', errorCodes.ACCESS_TOKEN_EXPIRED_ERROR);
  }
}

module.exports = {
  errorCodes,
  AccessTokenExpiredError
};
