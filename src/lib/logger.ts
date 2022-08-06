import pino from 'pino';
import * as process from 'process';

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

const logger = pino(loggerConfig);

export default logger;
