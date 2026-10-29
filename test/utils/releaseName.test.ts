import { normalizeReleaseName } from '../../src/utils/releaseName';

describe('normalizeReleaseName', () => {
  it.each([
    undefined, null, '', ' ', '\t\n', 'null', ' NULL ', 'undefined', '\tUnDeFiNeD\n', 'nan', ' NaN ',
    true, false, {}, [], [ 'release' ], NaN, Infinity, -Infinity,
  ])('normalizes absent or invalid value %p to null', (value) => {
    expect(normalizeReleaseName(value)).toBeNull();
  });

  it.each([
    [0, '0'],
    [-12, '-12'],
    [1.5, '1.5'],
    [Number.MAX_VALUE, String(Number.MAX_VALUE)],
    ['0', '0'],
    [' original / build+7 ', ' original / build+7 '],
    ['\tcanary build:AbC\n', '\tcanary build:AbC\n'],
    ['null-build', 'null-build'],
    ['NaN+1', 'NaN+1'],
    ['Infinity', 'Infinity'],
  ])('preserves meaningful identifier %p as %p', (value, expected) => {
    expect(normalizeReleaseName(value)).toBe(expected);
  });
});
