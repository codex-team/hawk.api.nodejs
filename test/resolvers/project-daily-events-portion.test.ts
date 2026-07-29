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

  it('should apply fallback title for null, empty and blank payload titles', async () => {
    const findDailyEventsPortion = jest.fn().mockResolvedValue({
      nextCursor: null,
      dailyEvents: [
        {
          id: 'daily-1',
          groupHash: 'group-1',
          event: {
            _id: 'repetition-1',
            originalEventId: 'event-1',
            payload: {
              title: null,
            },
          },
        },
        {
          id: 'daily-2',
          groupHash: 'group-2',
          event: {
            _id: 'repetition-2',
            originalEventId: 'event-2',
            payload: {
              title: '',
            },
          },
        },
        {
          id: 'daily-3',
          groupHash: 'group-3',
          event: {
            _id: 'repetition-3',
            originalEventId: 'event-3',
            payload: {
              title: '   ',
            },
          },
        },
      ],
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
    };

    const result = await projectResolver.Project.dailyEventsPortion(project, args, {}) as {
      dailyEvents: Array<{ event: { payload: { title: string } } }>;
    };

    expect(result.dailyEvents[0].event.payload.title).toBe('Unknown');
    expect(result.dailyEvents[1].event.payload.title).toBe('Unknown');
    expect(result.dailyEvents[2].event.payload.title).toBe('Unknown');
  });

  it('should keep payload title when it is valid', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const findDailyEventsPortion = jest.fn().mockResolvedValue({
      nextCursor: null,
      dailyEvents: [
        {
          id: 'daily-1',
          groupHash: 'group-1',
          event: {
            _id: 'repetition-1',
            originalEventId: 'event-1',
            payload: {
              title: 'TypeError',
            },
          },
        },
      ],
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
    };

    const result = await projectResolver.Project.dailyEventsPortion(project, args, {}) as {
      dailyEvents: Array<{ event: { payload: { title: string } } }>;
    };

    expect(result.dailyEvents[0].event.payload.title).toBe('TypeError');
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('should cap backtrace frames and sourceCode size in list response', async () => {
    const longLine = 'x'.repeat(200);
    const frames = Array.from({ length: 80 }, (_, index) => {
      return {
        file: `frame-${index}.rb`,
        line: index + 1,
        sourceCode: Array.from({ length: 30 }, (__, lineIndex) => {
          return {
            line: lineIndex + 1,
            content: longLine,
          };
        }),
      };
    });
    const findDailyEventsPortion = jest.fn().mockResolvedValue({
      nextCursor: null,
      dailyEvents: [
        {
          id: 'daily-1',
          groupHash: 'group-1',
          event: {
            _id: 'repetition-1',
            originalEventId: 'event-1',
            payload: {
              title: 'PG::UniqueViolation',
              backtrace: frames,
            },
          },
        },
      ],
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
    };

    const result = await projectResolver.Project.dailyEventsPortion(project, args, {}) as {
      dailyEvents: Array<{
        event: {
          payload: {
            title: string;
            backtrace: Array<{
              file: string;
              sourceCode: Array<{ content: string }>;
            }>;
          };
        };
      }>;
    };

    const backtrace = result.dailyEvents[0].event.payload.backtrace;

    expect(backtrace).toHaveLength(20);
    expect(backtrace[0].file).toBe('frame-0.rb');
    expect(backtrace[0].sourceCode).toHaveLength(21);
    expect(backtrace[0].sourceCode[0].content.endsWith('…')).toBe(true);
    expect(backtrace[19].file).toBe('frame-19.rb');
  });
});
