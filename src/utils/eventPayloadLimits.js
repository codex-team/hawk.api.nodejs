/**
 * Temporary limits for heavy event payloads in list responses.
 * Deep Rails backtraces with sourceCode were producing multi‑MB ProjectDailyEvents
 * responses and 502s behind the API gateway.
 */

const MAX_DAILY_EVENTS_BACKTRACE_FRAMES =
  Number(process.env.MAX_DAILY_EVENTS_BACKTRACE_FRAMES) || 20;

const MAX_DAILY_EVENTS_SOURCE_CODE_LINES =
  Number(process.env.MAX_DAILY_EVENTS_SOURCE_CODE_LINES) || 21;

const MAX_DAILY_EVENTS_CODE_LINE_LENGTH =
  Number(process.env.MAX_DAILY_EVENTS_CODE_LINE_LENGTH) || 140;

/**
 * Trim a string to max length and append ellipsis when truncated.
 *
 * @param {unknown} content - source line content
 * @param {number} maxLength - max characters to keep
 * @returns {unknown}
 */
function trimCodeLine(content, maxLength = MAX_DAILY_EVENTS_CODE_LINE_LENGTH) {
  if (typeof content !== 'string') {
    return content;
  }

  if (content.length <= maxLength) {
    return content;
  }

  return `${content.slice(0, maxLength)}…`;
}

/**
 * Cap backtrace frames and sourceCode size for list payloads.
 * Keeps sourceCode for UI, but limits frames/lines so list responses stay small.
 *
 * @param {unknown} backtrace - event payload backtrace
 * @returns {unknown}
 */
function limitBacktraceForDailyEventsList(backtrace) {
  if (!Array.isArray(backtrace)) {
    return backtrace;
  }

  return backtrace.slice(0, MAX_DAILY_EVENTS_BACKTRACE_FRAMES).map((frame) => {
    if (!frame || typeof frame !== 'object') {
      return frame;
    }

    if (!Array.isArray(frame.sourceCode)) {
      return frame;
    }

    return {
      ...frame,
      sourceCode: frame.sourceCode
        .slice(0, MAX_DAILY_EVENTS_SOURCE_CODE_LINES)
        .map((line) => {
          if (!line || typeof line !== 'object') {
            return line;
          }

          return {
            ...line,
            content: trimCodeLine(line.content),
          };
        }),
    };
  });
}

module.exports = {
  MAX_DAILY_EVENTS_BACKTRACE_FRAMES,
  MAX_DAILY_EVENTS_SOURCE_CODE_LINES,
  MAX_DAILY_EVENTS_CODE_LINE_LENGTH,
  limitBacktraceForDailyEventsList,
};
