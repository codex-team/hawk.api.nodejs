import '../../src/env-test';

import getEventsFactory from '../../src/resolvers/helpers/eventsFactory';

jest.mock('../../src/resolvers/helpers/eventsFactory', () => ({
  __esModule: true,
  default: jest.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const eventResolvers = require('../../src/resolvers/event') as {
  Mutation: {
    bulkVisitEvents: (
      o: unknown,
      args: { projectId: string; eventIds: string[] },
      ctx: any
    ) => Promise<{ success: boolean; modifiedCount: number }>;
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

  it('should call factory and return normalized response', async () => {
    bulkVisitEvents.mockResolvedValue({
      acknowledged: true,
      modifiedCount: 1,
    });

    const result = await eventResolvers.Mutation.bulkVisitEvents(
      {},
      {
        projectId: 'p1',
        eventIds: [ '507f1f77bcf86cd799439012' ],
      },
      ctx
    );

    expect(bulkVisitEvents).toHaveBeenCalledWith(
      [ '507f1f77bcf86cd799439012' ],
      '507f1f77bcf86cd799439011'
    );
    expect(result).toEqual({
      success: true,
      modifiedCount: 1,
    });
  });

  it('should throw when ids contain invalid values', async () => {
    await expect(eventResolvers.Mutation.bulkVisitEvents(
      {},
      {
        projectId: 'p1',
        eventIds: ['bad-1', 'bad-2'],
      },
      ctx
    )).rejects.toThrow('eventIds must contain only valid ids');
    expect(bulkVisitEvents).not.toHaveBeenCalled();
  });
});
