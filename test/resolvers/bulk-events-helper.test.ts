import '../../src/env-test';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseBulkEventIds } = require('../../src/resolvers/helpers/bulkEventUtils') as {
  parseBulkEventIds: (eventIds: string[]) => string[];
};

describe('bulkEvents helper', () => {
  it('should deduplicate valid ids', () => {
    const validA = '507f1f77bcf86cd799439011';
    const validB = '507f1f77bcf86cd799439012';
    const result = parseBulkEventIds([validA, validA, validB]);

    expect(result).toEqual([validA, validB]);
  });

  it('should throw when eventIds is empty', () => {
    expect(() => parseBulkEventIds([])).toThrow('eventIds must contain at least one id');
  });

  it('should throw when at least one id is invalid', () => {
    expect(() => parseBulkEventIds(['507f1f77bcf86cd799439011', 'bad-id'])).toThrow(
      'eventIds must contain only valid ids'
    );
  });
});
