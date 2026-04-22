import '../../src/env-test';

import { UserInputError } from 'apollo-server-express';

jest.mock('../../src/utils/personalNotifications', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/resolvers/helpers/eventsFactory', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import getEventsFactory from '../../src/resolvers/helpers/eventsFactory';
import sendPersonalNotification from '../../src/utils/personalNotifications';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const eventResolvers = require('../../src/resolvers/event') as {
  EventsMutations: {
    bulkUpdateAssignee: (
      o: unknown,
      args: { input: { projectId: string; eventIds: string[]; assignee?: string | null } },
      ctx: any
    ) => Promise<{ updatedCount: number; updatedEventIds: string[]; failedEventIds: string[] }>;
  };
};

const bulkUpdateAssignee = jest.fn();

describe('EventsMutations.bulkUpdateAssignee', () => {
  const ctx = {
    user: { id: 'u1' },
    factories: {
      usersFactory: {
        findById: jest.fn().mockResolvedValue({ id: 'assignee-1' }),
        dataLoaders: {
          userById: {
            load: jest.fn().mockResolvedValue({ id: 'assignee-1', email: 'a@a.a' }),
          },
        },
      },
      projectsFactory: {
        findById: jest.fn().mockResolvedValue({ workspaceId: 'w1' }),
      },
      workspacesFactory: {
        findById: jest.fn().mockResolvedValue({
          getMemberInfo: jest.fn().mockResolvedValue({ userId: 'assignee-1' }),
        }),
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getEventsFactory as unknown as jest.Mock).mockReturnValue({
      bulkUpdateAssignee,
    });
    bulkUpdateAssignee.mockResolvedValue({
      updatedCount: 1,
      updatedEventIds: [ '507f1f77bcf86cd799439011' ],
      failedEventIds: [],
    });
  });

  it('should throw when eventIds is empty', async () => {
    await expect(
      eventResolvers.EventsMutations.bulkUpdateAssignee(
        {},
        { input: { projectId: 'p1', eventIds: [], assignee: 'assignee-1' } },
        ctx
      )
    ).rejects.toThrow(UserInputError);
    expect(bulkUpdateAssignee).not.toHaveBeenCalled();
  });

  it('should call factory for bulk assign', async () => {
    const result = await eventResolvers.EventsMutations.bulkUpdateAssignee(
      {},
      {
        input: {
          projectId: 'p1',
          eventIds: [ '507f1f77bcf86cd799439011' ],
          assignee: 'assignee-1',
        },
      },
      ctx
    );

    expect(result.updatedCount).toBe(1);
    expect(bulkUpdateAssignee).toHaveBeenCalledWith(
      [ '507f1f77bcf86cd799439011' ],
      'assignee-1'
    );
    expect(sendPersonalNotification).toHaveBeenCalledTimes(1);
    expect(sendPersonalNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'assignee-1' }),
      expect.objectContaining({
        type: 'assignee',
        payload: expect.objectContaining({
          assigneeId: 'assignee-1',
          projectId: 'p1',
          whoAssignedId: 'u1',
          eventId: '507f1f77bcf86cd799439011',
        }),
      })
    );
  });

  it('should validate ids on resolver level and merge invalid ids into failedEventIds', async () => {
    bulkUpdateAssignee.mockResolvedValue({
      updatedCount: 1,
      updatedEventIds: [ '507f1f77bcf86cd799439011' ],
      failedEventIds: [ '507f1f77bcf86cd799439099' ],
    });

    const result = await eventResolvers.EventsMutations.bulkUpdateAssignee(
      {},
      {
        input: {
          projectId: 'p1',
          eventIds: [ '507f1f77bcf86cd799439011', 'invalid-id' ],
          assignee: 'assignee-1',
        },
      },
      ctx
    );

    expect(bulkUpdateAssignee).toHaveBeenCalledWith(
      [ '507f1f77bcf86cd799439011' ],
      'assignee-1'
    );
    expect(result).toEqual({
      updatedCount: 1,
      updatedEventIds: [ '507f1f77bcf86cd799439011' ],
      failedEventIds: [ '507f1f77bcf86cd799439099', 'invalid-id' ],
    });
  });

  it('should return early when all ids are invalid', async () => {
    const result = await eventResolvers.EventsMutations.bulkUpdateAssignee(
      {},
      {
        input: {
          projectId: 'p1',
          eventIds: [ 'bad-1', 'bad-2' ],
          assignee: 'assignee-1',
        },
      },
      ctx
    );

    expect(bulkUpdateAssignee).not.toHaveBeenCalled();
    expect(result).toEqual({
      updatedCount: 0,
      updatedEventIds: [],
      failedEventIds: [ 'bad-1', 'bad-2' ],
    });
  });

  it('should call factory for bulk clear assignee', async () => {
    await eventResolvers.EventsMutations.bulkUpdateAssignee(
      {},
      {
        input: {
          projectId: 'p1',
          eventIds: [ '507f1f77bcf86cd799439011' ],
          assignee: null,
        },
      },
      ctx
    );

    expect(bulkUpdateAssignee).toHaveBeenCalledWith(
      [ '507f1f77bcf86cd799439011' ],
      null
    );
  });
});
