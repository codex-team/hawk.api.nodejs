/**
 * Set of validation functions
 */
class Validator {
  /**
   * Check if the email is in the proper format
   *
   * @param {string} email – email to validate
   * @return {boolean}
   */
  static validateEmail(email) {
    /**
     * Only proper email formats are valid
     *
     * @type {RegExp}
     */
    const emailRegExp = /\S+@\S+\.\S+/;

    return emailRegExp.test(String(email).toLowerCase());
  }
}

module.exports = Validator;
