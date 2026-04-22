import '../../src/env-test';

import { UserInputError } from 'apollo-server-express';

jest.mock('../../src/resolvers/helpers/eventsFactory', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import getEventsFactory from '../../src/resolvers/helpers/eventsFactory';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const eventResolvers = require('../../src/resolvers/event') as {
  Mutation: {
    bulkToggleEventMarks: (
      o: unknown,
      args: { projectId: string; eventIds: string[]; mark: string },
      ctx: unknown
    ) => Promise<{ updatedCount: number; updatedEventIds: string[]; failedEventIds: string[] }>;
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

  it('should throw when mark is not supported', async () => {
    await expect(
      eventResolvers.Mutation.bulkToggleEventMarks(
        {},
        { projectId: 'p1', eventIds: [ '507f1f77bcf86cd799439012' ], mark: 'some-unknown-mark' },
        ctx
      )
    ).rejects.toThrow(UserInputError);

    await expect(
      eventResolvers.Mutation.bulkToggleEventMarks(
        {},
        { projectId: 'p1', eventIds: [ '507f1f77bcf86cd799439012' ], mark: 'some-unknown-mark' },
        ctx
      )
    ).rejects.toThrow('bulkToggleEventMarks supports only resolved, ignored and starred marks');

    expect(bulkToggleEventMark).not.toHaveBeenCalled();
  });

  it('should throw when eventIds is empty', async () => {
    await expect(
      eventResolvers.Mutation.bulkToggleEventMarks(
        {},
        { projectId: 'p1', eventIds: [], mark: 'ignored' },
        ctx
      )
    ).rejects.toThrow('eventIds must contain at least one id');

    expect(bulkToggleEventMark).not.toHaveBeenCalled();
  });

  it('should call factory with original event ids and return its result', async () => {
    const payload = { updatedCount: 2, updatedEventIds: [ 'a', 'b' ], failedEventIds: [ 'x' ] };

    bulkToggleEventMark.mockResolvedValue(payload);

    const result = await eventResolvers.Mutation.bulkToggleEventMarks(
      {},
      {
        projectId: 'p1',
        eventIds: [ '507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012' ],
        mark: 'resolved',
      },
      ctx
    );

    expect(getEventsFactory).toHaveBeenCalledWith(ctx, 'p1');
    expect(bulkToggleEventMark).toHaveBeenCalledWith(
      [ '507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012' ],
      'resolved'
    );
    expect(result).toEqual(payload);
  });

  it('should allow starred mark for bulk toggle', async () => {
    const payload = { updatedCount: 1, updatedEventIds: [ '507f1f77bcf86cd799439011' ], failedEventIds: [] };

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
    expect(result).toEqual(payload);
  });

});
