/**
 * Model Factory class
 */
class Factory {
  /**
   * Validates limit value
   * @param limit
   * @return {Number}
   */
  validateLimit(limit) {
    limit = Math.max(0, limit);

    if (limit > 100) {
      throw Error('Invalid limit value');
    }

    return limit;
  }

  /**
   * Validate skip value
   * @param skip
   * @return {Number}
   */
  validateSkip(skip) {
    skip = Math.max(0, skip);

    return skip;
  }
}

module.exports = Factory;
