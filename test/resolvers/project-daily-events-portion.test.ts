import '../../src/env-test';

jest.mock('../../src/integrations/github/service', () => require('../__mocks__/github-service'));

jest.mock('../../src/resolvers/helpers/eventsFactory', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// @ts-expect-error - CommonJS module, TypeScript can't infer types properly
import projectResolverModule from '../../src/resolvers/project';
import getEventsFactory from '../../src/resolvers/helpers/eventsFactory';

const projectResolver = projectResolverModule as {
  Project: {
    dailyEventsPortion: (...args: unknown[]) => Promise<unknown>;
  };
};

describe('Project resolver dailyEventsPortion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should pass assignee filter to events factory', async () => {
    const findDailyEventsPortion = jest.fn().mockResolvedValue({
      nextCursor: null,
      dailyEvents: [],
    });
    (getEventsFactory as unknown as jest.Mock).mockReturnValue({
      findDailyEventsPortion,
    });

    const project = { _id: 'project-1' };
    const args = {
      limit: 50,
      nextCursor: null,
      sort: 'BY_DATE',
      filters: { ignored: true },
      search: 'TypeError',
      release: '1.0.0',
      assignee: 'user-123',
    };

    await projectResolver.Project.dailyEventsPortion(project, args, {});

    expect(findDailyEventsPortion).toHaveBeenCalledWith(
      50,
      null,
      'BY_DATE',
      { ignored: true },
      'TypeError',
      '1.0.0',
      'user-123'
    );
  });

  it('should pass assignee sentinel for unassigned filter to factory', async () => {
    const findDailyEventsPortion = jest.fn().mockResolvedValue({
      nextCursor: null,
      dailyEvents: [],
    });
    (getEventsFactory as unknown as jest.Mock).mockReturnValue({
      findDailyEventsPortion,
    });

    const project = { _id: 'project-1' };
    const args = {
      limit: 50,
      nextCursor: null,
      sort: 'BY_DATE',
      filters: {},
      search: '',
      assignee: '__filter_unassigned__',
    };

    await projectResolver.Project.dailyEventsPortion(project, args, {});

    expect(findDailyEventsPortion).toHaveBeenCalledWith(
      50,
      null,
      'BY_DATE',
      {},
      '',
      undefined,
      '__filter_unassigned__'
    );
  });

  it('should call factory with undefined assignee when assignee argument is omitted', async () => {
    const findDailyEventsPortion = jest.fn().mockResolvedValue({
      nextCursor: null,
      dailyEvents: [],
    });
    (getEventsFactory as unknown as jest.Mock).mockReturnValue({
      findDailyEventsPortion,
    });

    const project = { _id: 'project-1' };
    const args = {
      limit: 10,
      nextCursor: null,
      sort: 'BY_DATE',
      filters: {},
      search: '',
      release: undefined,
    };

    await projectResolver.Project.dailyEventsPortion(project, args, {});

    expect(findDailyEventsPortion).toHaveBeenCalledWith(
      10,
      null,
      'BY_DATE',
      {},
      '',
      undefined,
      undefined
    );
  });
});
