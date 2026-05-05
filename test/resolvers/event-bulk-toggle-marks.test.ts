import '../../src/env-test';

import getEventsFactory from '../../src/resolvers/helpers/eventsFactory';

jest.mock('../../src/resolvers/helpers/eventsFactory', () => ({
  __esModule: true,
  default: jest.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const eventResolvers = require('../../src/resolvers/event') as {
  Mutation: {
    bulkSetEventMarks: (
      o: unknown,
      args: { projectId: string; eventIds: string[]; mark: string; enabled: boolean },
      ctx: unknown
    ) => Promise<{ success: boolean; modifiedCount: number }>;
  };
};

const bulkSetEventMarks = jest.fn();

describe('Mutation.bulkSetEventMarks', () => {
  const ctx = {};

  beforeEach(() => {
    jest.clearAllMocks();
    (getEventsFactory as unknown as jest.Mock).mockReturnValue({
      bulkSetEventMarks,
    });
  });

  it('should throw when eventIds is empty', async () => {
    await expect(
      eventResolvers.Mutation.bulkSetEventMarks(
        {},
        {
          projectId: 'p1',
          eventIds: [],
          mark: 'ignored',
          enabled: true,
        },
        ctx
      )
    ).rejects.toThrow('eventIds must contain at least one id');

    expect(bulkSetEventMarks).not.toHaveBeenCalled();
  });

  it('should call factory with original event ids and return its result', async () => {
    const payload = {
      acknowledged: true,
      modifiedCount: 2,
    };

    bulkSetEventMarks.mockResolvedValue(payload);

    const result = await eventResolvers.Mutation.bulkSetEventMarks(
      {},
      {
        projectId: 'p1',
        eventIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
        mark: 'resolved',
        enabled: true,
      },
      ctx
    );

    expect(getEventsFactory).toHaveBeenCalledWith(ctx, 'p1');
    expect(bulkSetEventMarks).toHaveBeenCalledWith(
      ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
      'resolved',
      true
    );
    expect(result).toEqual({
      success: true,
      modifiedCount: 2,
    });
  });

  it('should clear starred mark when enabled is false', async () => {
    const payload = {
      acknowledged: true,
      modifiedCount: 1,
    };

    bulkSetEventMarks.mockResolvedValue(payload);

    const result = await eventResolvers.Mutation.bulkSetEventMarks(
      {},
      {
        projectId: 'p1',
        eventIds: [ '507f1f77bcf86cd799439011' ],
        mark: 'starred',
        enabled: false,
      },
      ctx
    );

    expect(bulkSetEventMarks).toHaveBeenCalledWith(
      [ '507f1f77bcf86cd799439011' ],
      'starred',
      false
    );
    expect(result).toEqual({
      success: true,
      modifiedCount: 1,
    });
  });

  it('should throw for invalid ids', async () => {
    await expect(eventResolvers.Mutation.bulkSetEventMarks(
      {},
      {
        projectId: 'p1',
        eventIds: ['507f1f77bcf86cd799439011', 'invalid-id'],
        mark: 'ignored',
        enabled: true,
      },
      ctx
    )).rejects.toThrow('eventIds must contain only valid ids');
    expect(bulkSetEventMarks).not.toHaveBeenCalled();
  });
});
