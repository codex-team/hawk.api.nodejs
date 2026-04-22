import '../../src/env-test';

jest.mock('../../src/utils/personalNotifications', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));

import sendPersonalNotification from '../../src/utils/personalNotifications';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fireAndForgetAssigneeNotifications } = require('../../src/resolvers/helpers/bulkEvents') as {
  fireAndForgetAssigneeNotifications: (args: {
    assigneeData: Record<string, unknown> | null;
    eventIds: string[];
    projectId: string;
    assigneeId: string;
    whoAssignedId: string;
  }) => void;
};

describe('fireAndForgetAssigneeNotifications', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should enqueue personal notification for each event id', async () => {
    fireAndForgetAssigneeNotifications({
      assigneeData: { id: 'assignee-1', email: 'assignee@hawk.so' },
      eventIds: [ 'e-1', 'e-2' ],
      projectId: 'p-1',
      assigneeId: 'assignee-1',
      whoAssignedId: 'u-1',
    });

    await Promise.resolve();

    expect(sendPersonalNotification).toHaveBeenCalledTimes(2);
    expect(sendPersonalNotification).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'assignee-1' }),
      {
        type: 'assignee',
        payload: {
          assigneeId: 'assignee-1',
          projectId: 'p-1',
          whoAssignedId: 'u-1',
          eventId: 'e-1',
        },
      }
    );
    expect(sendPersonalNotification).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'assignee-1' }),
      {
        type: 'assignee',
        payload: {
          assigneeId: 'assignee-1',
          projectId: 'p-1',
          whoAssignedId: 'u-1',
          eventId: 'e-2',
        },
      }
    );
  });

  it('should not call personal notifications when assignee data is empty', () => {
    fireAndForgetAssigneeNotifications({
      assigneeData: null,
      eventIds: [ 'e-1' ],
      projectId: 'p-1',
      assigneeId: 'assignee-1',
      whoAssignedId: 'u-1',
    });

    expect(sendPersonalNotification).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to enqueue assignee notifications: assignee data is empty'
    );
  });
});
