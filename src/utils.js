/**
 * Pick fields from object
 *
 * @param {Object} obj - target object
 * @param {...string} fields - fields to pick
 * @returns {Object} object with required fileds
 */
function pick(obj, ...fields) {
  return fields.reduce((a, x) => {
    if (obj.hasOwnProperty(x)) a[x] = obj[x];
    return a;
  }, {});
}

/**
 * Pick fields from one object to another
 *
 * @param {Object} target - target object
 * @param {Object} source - source object
 * @param {...string} fields - fields to copy
 */
function pickTo(target, source, ...fields) {
  fields.forEach(field => {
    if (source.hasOwnProperty(field)) {
      target[field] = source[field];
    }
  });
}

module.exports = {
  pick,
  pickTo
};
