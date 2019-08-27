/**
 * Check if object has only given props
 *
 * @param {object} object- object to check
 * @param {object} props - object must contain only this props
 * @return {Promise<Boolean>}
 */
module.exports = async function objectHasOnlyProps(object, props) {
  for (const prop in object) {
    if (!props[prop]) {
      return false;
    }
  }

  return true;
};
