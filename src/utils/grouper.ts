/**
 * Group array of Objects by key
 *
 * @example
 *
 * const cars = [
 * { brand: 'Audi', color: 'black' },
 * { brand: 'Audi', color: 'white' },
 * { brand: 'Ferrari', color: 'red' },
 * { brand: 'Ford', color: 'white' },
 * { brand: 'Peugeot', color: 'white' }
 * ];
 *
 * const groupByBrand = groupBy('brand');
 * const groupByColor = groupBy('color');
 *
 * console.log(
 *   JSON.stringify({
 *     carsByBrand: groupByBrand(cars),
 *     carsByColor: groupByColor(cars)
 *   }, null, 2)
 * );
 *
 * @param {string} key - key for grouping
 */
export const groupBy =
  (key: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (array: any[]): object => // array of objects to group
      array.reduce((objectsByKeyValue, obj) => {
        const value = obj[key];

        /**
         * Case when we need to group by field that stored numbers,
         * for example, date(timestamp) - we add "key:" prefix to prevent sorting of object keys
         */
        let groupingKey = key;

        if (typeof value === 'number') {
          groupingKey = key + ':' + value;
        }

        objectsByKeyValue[groupingKey] = (objectsByKeyValue[groupingKey] || []).concat(obj);

        return objectsByKeyValue;
      }, {});
