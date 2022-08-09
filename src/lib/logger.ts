import pino from 'pino';
import * as process from 'process';
import config, { LoggingConfig } from './config.js';

const loggerConfig = process.env['NODE_ENV'] === 'production'
  ? {}
  : {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    },
  };

const rootLogger = pino(loggerConfig);

/**
 * Creates child logger and returns it.
 *
 * @param moduleName - name of the module that is logging
 */
export function getLogger(moduleName: keyof LoggingConfig): pino.Logger {
  const childLogger = rootLogger.child({
    module: moduleName,
  });

  let logLevel = config.logging[moduleName];

  if (typeof logLevel === 'boolean') {
    logLevel = logLevel ? 'info' : 'silent';
  }

  childLogger.level = logLevel;

  return childLogger;
}

const logger = getLogger('global');

export default logger;
