const { ObjectID } = require('mongodb');

/**
 * Returns real type of passed variable
 * @param {*} obj - object to check
 * @return {string}
 */
function typeOf(obj) {
  return Object.prototype.toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
}

/**
 * Converts nested objects to one objects with properties as paths to nested props
 * Example:
 *
 * objectToPath({userId: ObjectID("5d63c84aa17ed33e62ed2edb"), settings: {email: {enabled: true}}})
 *
 * // { userId: 5d63c84aa17ed33e62ed2edb, 'settings.email.enabled': true }
 * @param {*} obj - object
 * @param [curr] - current property
 * @param [dict] - result
 */
function propsToPaths(obj, curr = null, dict = {}) {
  Object.keys(obj).forEach((key) => {
    if (typeOf(obj[key]) === 'object' && !(obj[key] instanceof ObjectID)) {
      propsToPaths(obj[key], curr ? `${curr}.${key}` : key, dict);
    } else {
      dict[curr ? `${curr}.${key}` : key] = obj[key];
    }
  });
  return dict;
}

module.exports = { typeOf, propsToPaths };
