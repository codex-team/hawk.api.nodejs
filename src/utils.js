/**
 * Pick fields from object
 *
 * @param {Object} obj - target object
 * @param {...string} fields - fields to pick
 * @returns {Object} object with required fields
 */
function pickFields(obj, ...fields) {
  return fields.reduce((acc, field) => {
    if (obj.hasOwnProperty(field)) acc[field] = obj[field];
    return acc;
  }, {});
}

/**
 * Pick fields from one object to another
 *
 * @param {Object} target - target object
 * @param {Object} source - source object
 * @param {...string} fields - fields to copy
 */
function pickFieldsTo(target, source, ...fields) {
  fields.forEach(field => {
    if (source.hasOwnProperty(field)) {
      target[field] = source[field];
    }
  });
}

module.exports = {
  pickFields,
  pickFieldsTo
};
