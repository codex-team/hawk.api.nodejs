import HawkCatcher from '@hawk.so/nodejs';

export const SLOW_OPERATION_THRESHOLD_MS = 10000;
const MAX_CONTEXT_STRING_LENGTH = 2500;

/**
 * Truncate text for slow operation context fields.
 *
 * @param value - text to truncate
 * @param maxLength - max allowed length
 * @returns truncated text
 */
function truncateText(value: string, maxLength = MAX_CONTEXT_STRING_LENGTH): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}…`;
}

/**
 * Truncate long string values in alert context.
 *
 * @param context - alert context
 * @returns sanitized context
 */
function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => {
      if (typeof value === 'string') {
        return [key, truncateText(value)];
      }

      return [key, value];
    })
  );
}

/**
 * Send slow operation alert to Hawk via HawkCatcher.
 *
 * @param message - short alert message
 * @param durationMs - operation duration in milliseconds
 * @param context - additional alert context
 */
export function notifySlowOperation(
  message: string,
  durationMs: number,
  context: Record<string, unknown> = {}
): void {
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.NODE_ENV === 'e2e' ||
    durationMs < SLOW_OPERATION_THRESHOLD_MS
  ) {
    return;
  }

  try {
    HawkCatcher.send(new Error(message), {
      durationMs,
      ...sanitizeContext(context),
    });
  } catch (error) {
    console.log('Couldn\'t send slow operation alert to Hawk', error);
  }
}

export { truncateText };
