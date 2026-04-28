import '../../src/env-test';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseBulkEventIds } = require('../../src/resolvers/helpers/bulkEventUtils') as {
  parseBulkEventIds: (eventIds: string[]) => { validEventIds: string[]; invalidEventIds: string[] };
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

  it('should throw when eventIds is empty', () => {
    expect(() => parseBulkEventIds([])).toThrow('eventIds must contain at least one id');
  });
});
