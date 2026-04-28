import '../../src/env-test';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseBulkEventIds, mergeFailedEventIds } = require('../../src/resolvers/helpers/bulkEventUtils') as {
  parseBulkEventIds: (eventIds: string[]) => { validEventIds: string[]; invalidEventIds: string[] };
  mergeFailedEventIds: (
    result: { failedEventIds?: string[] },
    invalidEventIds: string[]
  ) => string[];
};

describe('bulkEvents helper', () => {
  it('should split valid and invalid ids and deduplicate them', () => {
    const validA = '507f1f77bcf86cd799439011';
    const validB = '507f1f77bcf86cd799439012';
    const invalid = 'bad-id';
    const result = parseBulkEventIds([ validA, validA, invalid, validB ]);

    expect(result).toEqual({
      validEventIds: [ validA, validB ],
      invalidEventIds: [ invalid ],
    });
  });

  it('should merge failed ids from factory and invalid resolver ids', () => {
    const result = mergeFailedEventIds(
      { failedEventIds: [ '507f1f77bcf86cd799439011' ] },
      [ 'bad-id', '507f1f77bcf86cd799439011' ]
    );

    expect(result).toEqual([ '507f1f77bcf86cd799439011', 'bad-id' ]);
  });

  it('should throw when eventIds is empty', () => {
    expect(() => parseBulkEventIds([])).toThrow('eventIds must contain at least one id');
  });
});
