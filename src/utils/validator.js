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

  /**
   * Check if the string is in the proper format
   *
   * @param {string} str – string to validate
   * @param {number} maxLen – minimal string length
   * @param {number} minLen – maximum string length
   * @return {boolean}
   */
  static string(str, minLen = 1, maxLen = 255) {
    if (!str && minLen === 0) {
      return true;
    }

    return str.length >= minLen && str.length <= maxLen;
  }
}

module.exports = Validator;
