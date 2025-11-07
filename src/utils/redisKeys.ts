/**
 * Utility for composing Redis TimeSeries keys
 */

/**
 * Compose Redis TimeSeries key for project metrics
 *
 * @param suffix - time granularity suffix (minutely, hourly, daily)
 * @param projectId - project ID
 * @returns Redis key string
 *
 * @example
 * composeTimeSeriesKey('hourly', '123abc')
 * // => 'ts:events:123abc:hourly'
 */
export function composeTimeSeriesKey(
  suffix: string,
  projectId: string
): string {
  return `ts:events:${projectId}:${suffix}`;
}

/**
 * Compose Redis TimeSeries key for event-level metrics
 *
 * @param suffix - time granularity suffix (minutely, hourly, daily)
 * @param groupHash - event group hash
 * @returns Redis key string
 *
 * @example
 * composeEventTimeSeriesKey('daily', 'abc123def')
 * // => 'ts:events:abc123def:daily'
 */
export function composeEventTimeSeriesKey(
  suffix: string,
  groupHash: string
): string {
  return `ts:events:${groupHash}:${suffix}`;
}

/**
 * Get time granularity suffix based on groupBy interval
 *
 * @param groupBy - grouping interval in minutes (1=minute, 60=hour, 1440=day)
 * @returns suffix string (minutely, hourly, daily)
 */
export function getTimeSeriesSuffix(groupBy: number): string {
  if (groupBy === 1) {
    return 'minutely';
  } else if (groupBy === 60) {
    return 'hourly';
  } else if (groupBy === 1440) {
    return 'daily';
  }
  
  // For custom intervals, fallback to minutely with aggregation
  return 'minutely';
}

