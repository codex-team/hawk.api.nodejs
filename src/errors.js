const { ApolloError } = require('apollo-server-express');

/**
 * Error throws when user send expired access token and tries to access private resources
 */
class AccessTokenExpiredError extends ApolloError {
  /**
   * Error constructor
   */
  constructor() {
    super('You need to refresh your tokens', 'ACCESS_TOKEN_EXPIRED_ERROR');
  }
}

module.exports = {
  AccessTokenExpiredError
};
