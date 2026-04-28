import '../../src/env-test';

jest.mock('../../src/resolvers/helpers/eventsFactory', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import getEventsFactory from '../../src/resolvers/helpers/eventsFactory';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const eventResolvers = require('../../src/resolvers/event') as {
  Mutation: {
    bulkVisitEvents: (
      o: unknown,
      args: { projectId: string; eventIds: string[] },
      ctx: any
    ) => Promise<{ updatedEventIds: string[]; failedEventIds: string[] }>;
  };
};

const bulkVisitEvents = jest.fn();

describe('Mutation.bulkVisitEvents', () => {
  const ctx = {
    user: { id: '507f1f77bcf86cd799439011' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getEventsFactory as unknown as jest.Mock).mockReturnValue({ bulkVisitEvents });
  });

  it('should call factory with valid ids only and merge invalid ids', async () => {
    bulkVisitEvents.mockResolvedValue({
      updatedEventIds: [ '507f1f77bcf86cd799439012' ],
      failedEventIds: [ '507f1f77bcf86cd799439099' ],
    });

    const result = await eventResolvers.Mutation.bulkVisitEvents(
      {},
      { projectId: 'p1', eventIds: [ '507f1f77bcf86cd799439012', 'bad-id' ] },
      ctx
    );

    expect(bulkVisitEvents).toHaveBeenCalledWith(
      [ '507f1f77bcf86cd799439012' ],
      '507f1f77bcf86cd799439011'
    );
    expect(result).toEqual({
      updatedEventIds: [ '507f1f77bcf86cd799439012' ],
      failedEventIds: [ '507f1f77bcf86cd799439099', 'bad-id' ],
    });
  });

  it('should return early when all ids are invalid', async () => {
    const result = await eventResolvers.Mutation.bulkVisitEvents(
      {},
      { projectId: 'p1', eventIds: [ 'bad-1', 'bad-2' ] },
      ctx
    );

    expect(bulkVisitEvents).not.toHaveBeenCalled();
    expect(result).toEqual({
      updatedEventIds: [],
      failedEventIds: [ 'bad-1', 'bad-2' ],
    });
  });
});
