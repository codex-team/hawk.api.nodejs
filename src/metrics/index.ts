import client from 'prom-client';
import express from 'express';

/**
 * Create a Registry to register the metrics
 */
const register = new client.Registry();

/**
 * Add default Node.js metrics (CPU, memory, event loop, etc.)
 */
client.collectDefaultMetrics({ register });

/**
 * HTTP request duration histogram
 * Tracks request duration by route, method, and status code
 */
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
  registers: [ register ],
});

/**
 * HTTP request counter
 * Tracks count of HTTP requests by route, method, and status code
 */
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [ register ],
});

/**
 * Express middleware to track HTTP metrics
 */
export function metricsMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const start = Date.now();

  // Hook into response finish event to capture metrics
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    const route = req.route ? req.route.path : req.path;
    const method = req.method;
    const statusCode = res.statusCode.toString();

    // Record metrics
    httpRequestDuration.labels(method, route, statusCode).observe(duration);
    httpRequestCounter.labels(method, route, statusCode).inc();
  });

  next();
}

/**
 * Create metrics server
 * @returns Express application serving metrics endpoint
 */
export function createMetricsServer(): express.Application {
  const metricsApp = express();

  metricsApp.get('/metrics', async (req, res) => {
    res.setHeader('Content-Type', register.contentType);
    const metrics = await register.metrics();

    res.send(metrics);
  });

  return metricsApp;
}
