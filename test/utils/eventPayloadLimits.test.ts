import {
  MAX_DAILY_EVENTS_BACKTRACE_FRAMES,
  MAX_DAILY_EVENTS_CODE_LINE_LENGTH,
  MAX_DAILY_EVENTS_SOURCE_CODE_LINES,
  limitBacktraceForDailyEventsList,
} from '../../src/utils/eventPayloadLimits';

describe('eventPayloadLimits', () => {
  it('should return non-array backtrace as is', () => {
    expect(limitBacktraceForDailyEventsList(null)).toBeNull();
    expect(limitBacktraceForDailyEventsList(undefined)).toBeUndefined();
  });

  it('should cap frames and sourceCode size while keeping sourceCode', () => {
    const longLine = 'x'.repeat(MAX_DAILY_EVENTS_CODE_LINE_LENGTH + 40);
    const backtrace = Array.from({ length: MAX_DAILY_EVENTS_BACKTRACE_FRAMES + 10 }, (_, index) => {
      return {
        file: `file-${index}.rb`,
        line: index,
        sourceCode: Array.from({ length: MAX_DAILY_EVENTS_SOURCE_CODE_LINES + 5 }, (__, lineIndex) => {
          return {
            line: lineIndex,
            content: longLine,
          };
        }),
      };
    });

    const limited = limitBacktraceForDailyEventsList(backtrace) as Array<{
      file: string;
      sourceCode: Array<{ content: string }>;
    }>;

    expect(limited).toHaveLength(MAX_DAILY_EVENTS_BACKTRACE_FRAMES);
    expect(limited[0].file).toBe('file-0.rb');
    expect(limited[0].sourceCode).toHaveLength(MAX_DAILY_EVENTS_SOURCE_CODE_LINES);
    expect(limited[0].sourceCode[0].content.endsWith('…')).toBe(true);
    expect(limited[0].sourceCode[0].content.length).toBe(MAX_DAILY_EVENTS_CODE_LINE_LENGTH + 1);
  });
});
