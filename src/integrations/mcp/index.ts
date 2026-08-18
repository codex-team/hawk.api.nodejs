import express from 'express';
import { ContextFactories } from 'src/types/graphql';
import { createMCPRouter } from "./mcp";

/**
 * Append MCP route to Express App
 * 
 * @param app - Express application instance
 * @param factories - context factories for database access
 */
export function appendMCPRoutes(app: express.Application, factories: ContextFactories): void {
  const router = createMCPRouter(factories);

  app.use('/integration/mcp', router);
}
