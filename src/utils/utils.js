const _ = require('lodash');

module.exports.deepMerge = deepMerge;
/**
 * Merge to objects recursively
 * @param {object} target
 * @param {object[]} sources
 * @return {object}
 */
function deepMerge(target, ...sources) {
  const isObject = (item) => item && typeOf(item) === 'object';

  return _.mergeWith({}, target, ...sources, function (_subject, _target) {
    if (_.isArray(_subject) && _.isArray(_target)) {
      const biggerArray = _subject.length > _target.length ? _subject : _target;
      const lesser = _subject.length > _target.length ? _target : _subject;

      return biggerArray.map((el, i) => {
        if (isObject(el) && isObject(lesser[i])) {
          return _.mergeWith({}, el, lesser[i]);
        } else {
          return el;
        }
      });
    }
  });
}

/**
 * Returns real type of passed variable
 * @param obj
 * @return {string}
 */
function typeOf(obj) {
  return Object.prototype.toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
}
