/**
 * Utility for composing Redis TimeSeries keys
 */

/**
 * Compose Redis TimeSeries key for project-level metrics
 *
 * @param granularity - time granularity (minutely, hourly, daily)
 * @param projectId - project ID
 * @param metricType - metric type (default: 'events-accepted')
 * @returns Redis key string in format: ts:project-{metricType}:{projectId}:{granularity}
 *
 * @example
 * composeProjectMetricsKey('hourly', '123abc')
 * // => 'ts:project-events-accepted:123abc:hourly'
 *
 * @example
 * composeProjectMetricsKey('daily', '123abc', 'events-rate-limited')
 * // => 'ts:project-events-rate-limited:123abc:daily'
 */
export function composeProjectMetricsKey(
  granularity: string,
  projectId: string,
  metricType = 'events-accepted'
): string {
  return `ts:project-${metricType}:${projectId}:${granularity}`;
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

