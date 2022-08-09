import fastify from 'fastify';
import promClient from 'prom-client';
import HttpStatusCode from './http-status-codes.js';
import logger, { getLogger } from './logger.js';
import config from './config.js';
import { accountsMongoDb } from './mongodb.js';

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
 * Creates and runs the metrics server.
 */
export default async function runMetricsServer(): Promise<void> {
  const metricsServerLogger = getLogger('metricsServer');
  const metricsServer = fastify({
    logger: metricsServerLogger,
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
    const mongodbAccountsPing = await accountsMongoDb.db().command({ ping: 1 }, { maxTimeMS: 1 });
    const data = {
      uptime: process.uptime(),
      message: 'ok',
      date: new Date(),
      mongodbAccountsPing,
    };

    reply.status(HttpStatusCode.SuccessOK).send(data);
  });

  await metricsServer.listen({
    port: config.metrics.port,
    host: config.metrics.host,
  });
  logger.info(`🚀 Metrics server ready at http://${config.metrics.host}:${config.metrics.port}`);
}
