/**
 * Asynchronous forEach function
 * @param {Array} array - array to iterate
 * @param {function} callback - callback for processing array items
 * @return {Promise<void>}
 */
module.exports = async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
};
