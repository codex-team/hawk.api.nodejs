const _ = require('lodash');

/**
 * Returns real type of passed variable
 * @param obj
 * @return {string}
 */
function typeOf(obj) {
  return Object.prototype.toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
}
