import morgan from 'morgan';
import express from 'express';
import { sgr, Effect } from './ansi';

/**
 * Setup custom GraphQL-aware morgan token.
 * Extracts operation name from GraphQL requests to show query/mutation names in logs.
 */
morgan.token('graphql-operation', (req: express.Request) => {
  if (req.body && req.body.operationName) {
    return req.body.operationName;
  }
  if (req.body && req.body.query) {
    /* Try to extract operation name from query string if operationName is not provided */
    const match = req.body.query.match(/(?:query|mutation)\s+(\w+)/);

    if (match && match[1]) {
      return sgr(sgr(match[1], Effect.ForegroundMagenta), Effect.Bold);
    }
  }

  return '-';
});

/**
 * Custom morgan format for GraphQL-aware logging.
 * Development: shows method, url, operation name, status, response time, content length
 * Production: Apache-style format with operation name included
 */
const customFormat = process.env.NODE_ENV === 'production'
  ? ':remote-addr - :remote-user [:date[clf]] ":method :url :graphql-operation" :status :res[content-length] bytes - :response-time ms'
  : ':method :url :graphql-operation :status :res[content-length] bytes - :response-time ms';

/**
 * Configured morgan middleware with GraphQL operation name logging
 */
export const requestLogger = morgan(customFormat);
