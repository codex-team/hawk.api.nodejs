import express from 'express';
import { ContextFactories } from 'src/types/graphql';
import { createMCPHandler } from './mcp';
import { useMCPAuth } from './auth';
import { authMiddleware } from './auth/authMiddleware';

/**
 * Appends MCP route to Express App
 *
 * @param app - Express application instance
 * @param factories - context factories for database access
 */
export function appendMCPRoutes(app: express.Application, factories: ContextFactories): void {
  useMCPAuth(app, factories);
  const handler = createMCPHandler(factories);

  app.use('/integration/mcp', authMiddleware, (req, res) => handler(req, res, req.body));
}
