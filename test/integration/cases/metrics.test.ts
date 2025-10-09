import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

/**
 * Env variables for API
 */
const apiEnv = dotenv.config({ path: path.join(__dirname, '../api.env') }).parsed || {};

/**
 * Axios instance to send requests to metrics endpoint
 */
const metricsInstance = axios.create({
  baseURL: `http://api:${apiEnv.METRICS_PORT || 9090}`,
});

describe('Prometheus Metrics', () => {
  test('Metrics endpoint is accessible', async () => {
    const response = await metricsInstance.get('/metrics');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/plain/);
  });

  test('Metrics endpoint returns prometheus format', async () => {
    const response = await metricsInstance.get('/metrics');

    // Check for some default Node.js metrics
    expect(response.data).toContain('nodejs_version_info');
    expect(response.data).toContain('process_cpu_user_seconds_total');
    expect(response.data).toContain('nodejs_heap_size_total_bytes');
  });

  test('Metrics endpoint includes custom HTTP metrics', async () => {
    const response = await metricsInstance.get('/metrics');

    // Check for our custom metrics
    expect(response.data).toContain('http_request_duration_seconds');
    expect(response.data).toContain('http_requests_total');
  });

  test('Metrics endpoint includes GraphQL metrics', async () => {
    const response = await metricsInstance.get('/metrics');

    // Check for GraphQL metrics
    expect(response.data).toContain('hawk_gql_operation_duration_seconds');
    expect(response.data).toContain('hawk_gql_operation_errors_total');
    expect(response.data).toContain('hawk_gql_resolver_duration_seconds');
  });

  test('Metrics endpoint includes MongoDB metrics', async () => {
    const response = await metricsInstance.get('/metrics');

    // Check for MongoDB metrics
    expect(response.data).toContain('hawk_mongo_command_duration_seconds');
    expect(response.data).toContain('hawk_mongo_command_errors_total');
  });
});
