import fastify, { FastifyInstance } from 'fastify';
import promClient from 'prom-client';
import HttpStatusCode from './http-status-codes.js';
import logger from './logger.js';

const collectDefaultMetrics = promClient.collectDefaultMetrics;
const Registry = promClient.Registry;
const register = new Registry();

collectDefaultMetrics({ register });

const homePage = `
<!DOCTYPE html>
<html lang="en">
<body>
    <a href="/metrics">metrics</a> <br>
    <a href="/health">health</a> <br>
</body>
</html>
`;

/**
 * Returns a fastify instance with the metrics server.
 */
export default function createMetricsServer(): FastifyInstance {
  const metricsServer = fastify({
    logger,
  });

  metricsServer.get('/', (_request, reply) => {
    reply
      .code(HttpStatusCode.SuccessOK)
      .type('text/html')
      .send(homePage);
  });

  metricsServer.get('/metrics', async (_request, reply) => {
    reply.code(HttpStatusCode.SuccessOK).send(await register.metrics());
  });

  metricsServer.get('/health', async (_request, reply) => {
    const data = {
      uptime: process.uptime(),
      message: 'ok',
      date: new Date(),
    };

    reply.status(HttpStatusCode.SuccessOK).send(data);
  });

  return metricsServer;
}
