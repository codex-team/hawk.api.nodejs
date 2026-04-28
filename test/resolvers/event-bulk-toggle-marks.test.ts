import '../../src/env-test';

import getEventsFactory from '../../src/resolvers/helpers/eventsFactory';

jest.mock('../../src/resolvers/helpers/eventsFactory', () => ({
  __esModule: true,
  default: jest.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const eventResolvers = require('../../src/resolvers/event') as {
  Mutation: {
    bulkToggleEventMarks: (
      o: unknown,
      args: { projectId: string; eventIds: string[]; mark: string },
      ctx: unknown
    ) => Promise<{ success: boolean; modifiedCount: number }>;
  };
};

const bulkToggleEventMark = jest.fn();

describe('Mutation.bulkToggleEventMarks', () => {
  const ctx = {};

  beforeEach(() => {
    jest.clearAllMocks();
    (getEventsFactory as unknown as jest.Mock).mockReturnValue({
      bulkToggleEventMark,
    });
  });

  it('should throw when eventIds is empty', async () => {
    await expect(
      eventResolvers.Mutation.bulkToggleEventMarks(
        {},
        {
          projectId: 'p1',
          eventIds: [],
          mark: 'ignored',
        },
        ctx
      )
    ).rejects.toThrow('eventIds must contain at least one id');

    expect(bulkToggleEventMark).not.toHaveBeenCalled();
  });

  it('should call factory with original event ids and return its result', async () => {
    const payload = {
      acknowledged: true,
      modifiedCount: 2,
    };

    bulkToggleEventMark.mockResolvedValue(payload);

    const result = await eventResolvers.Mutation.bulkToggleEventMarks(
      {},
      {
        projectId: 'p1',
        eventIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
        mark: 'resolved',
      },
      ctx
    );

    expect(getEventsFactory).toHaveBeenCalledWith(ctx, 'p1');
    expect(bulkToggleEventMark).toHaveBeenCalledWith(
      ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
      'resolved'
    );
    expect(result).toEqual({
      success: true,
      modifiedCount: 2,
    });
  });

  it('should allow starred mark for bulk toggle', async () => {
    const payload = {
      acknowledged: true,
      modifiedCount: 1,
    };

    bulkToggleEventMark.mockResolvedValue(payload);

    const result = await eventResolvers.Mutation.bulkToggleEventMarks(
      {},
      {
        projectId: 'p1',
        eventIds: [ '507f1f77bcf86cd799439011' ],
        mark: 'starred',
      },
      ctx
    );

    expect(bulkToggleEventMark).toHaveBeenCalledWith(
      [ '507f1f77bcf86cd799439011' ],
      'starred'
    );
    expect(result).toEqual({
      success: true,
      modifiedCount: 1,
    });
  });

  it('should throw for invalid ids', async () => {
    await expect(eventResolvers.Mutation.bulkToggleEventMarks(
      {},
      {
        projectId: 'p1',
        eventIds: ['507f1f77bcf86cd799439011', 'invalid-id'],
        mark: 'ignored',
      },
      ctx
    )).rejects.toThrow('eventIds must contain only valid ids');
    expect(bulkToggleEventMark).not.toHaveBeenCalled();
  });
});
