import RedisHelper, { TsRangeResult } from '../redisHelper';
import { composeProjectMetricsKey, getTimeSeriesSuffix } from '../utils/chartStorageKeys';

/**
 * Service for fetching chart data from Redis TimeSeries
 */
export default class ChartDataService {
  private redisHelper: RedisHelper;

  constructor(redisHelper: RedisHelper) {
    this.redisHelper = redisHelper;
  }

  /**
   * Get project chart data from Redis TimeSeries
   *
   * @param projectId - project ID
   * @param startDate - start date as ISO string (e.g., '2025-01-01T00:00:00Z')
   * @param endDate - end date as ISO string (e.g., '2025-01-31T23:59:59Z')
   * @param groupBy - grouping interval in minutes (1=minute, 60=hour, 1440=day)
   * @param timezoneOffset - user's local timezone offset in minutes (default: 0)
   * @param metricType - Redis metric type suffix (e.g., 'events-accepted', 'events-rate-limited')
   * @returns Array of data points with timestamp and count
   * @throws Error if Redis is not connected (caller should fallback to MongoDB)
   */
  public async getProjectChartData(
    projectId: string,
    startDate: string,
    endDate: string,
    groupBy: number,
    timezoneOffset = 0,
    metricType: string = 'events-accepted'
  ): Promise<{ timestamp: number; count: number }[]> {
    // Check if Redis is connected
    if (!this.redisHelper.isConnected()) {
      console.warn('[ChartDataService] Redis not connected, will fallback to MongoDB');
      throw new Error('Redis client not connected');
    }

    // Determine granularity and compose key
    const granularity = getTimeSeriesSuffix(groupBy);
    const key = composeProjectMetricsKey(granularity, projectId, metricType);

    // Parse ISO date strings to milliseconds
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const bucketMs = groupBy * 60 * 1000;

    // Fetch data from Redis
    let result: TsRangeResult[] = [];

    try {
      result = await this.redisHelper.tsRange(
        key,
        start.toString(),
        end.toString(),
        'sum',
        bucketMs.toString()
      );
    } catch (err: any) {
      if (err.message.includes('TSDB: the key does not exist')) {
        console.warn(`[ChartDataService] Key ${key} does not exist, returning zeroed data`);
        result = [];
      } else {
        throw err;
      }
    }

    // Transform data from Redis
    const dataPoints: { [ts: number]: number } = {};

    for (const [tsStr, valStr] of result) {
      const tsMs = Number(tsStr);

      dataPoints[tsMs] = Number(valStr) || 0;
    }

    // Fill missing intervals with zeros
    const filled: { timestamp: number; count: number }[] = [];
    let current = start;

    // Round current to the nearest bucket boundary
    current = Math.floor(current / bucketMs) * bucketMs;

    while (current <= end) {
      const count = dataPoints[current] || 0;

      filled.push({
        timestamp: Math.floor((current + timezoneOffset * 60 * 1000) / 1000),
        count,
      });
      current += bucketMs;
    }

    return filled.sort((a, b) => a.timestamp - b.timestamp);
  }
}
