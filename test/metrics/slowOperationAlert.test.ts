import HawkCatcher from '@hawk.so/nodejs';
import { notifySlowOperation, SLOW_OPERATION_THRESHOLD_MS } from '../../src/metrics/slowOperationAlert';

jest.mock('@hawk.so/nodejs', () => ({
  __esModule: true,
  default: {
    send: jest.fn(),
  },
}));

describe('slowOperationAlert', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should send Hawk alert for slow operations', () => {
    notifySlowOperation('Slow GraphQL operation: query ProjectDailyEvents', SLOW_OPERATION_THRESHOLD_MS, {
      projectId: 'project-1',
    });

    expect(HawkCatcher.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Slow GraphQL operation: query ProjectDailyEvents' }),
      {
        durationMs: SLOW_OPERATION_THRESHOLD_MS,
        projectId: 'project-1',
      }
    );
  });

  it('should not send Hawk alert for fast operations', () => {
    notifySlowOperation('fast op', SLOW_OPERATION_THRESHOLD_MS - 1, {
      projectId: 'project-1',
    });

    expect(HawkCatcher.send).not.toHaveBeenCalled();
  });

  it('should not send Hawk alert in test environment', () => {
    process.env.NODE_ENV = 'test';

    notifySlowOperation('slow op', SLOW_OPERATION_THRESHOLD_MS, {
      projectId: 'project-1',
    });

    expect(HawkCatcher.send).not.toHaveBeenCalled();
  });
});
