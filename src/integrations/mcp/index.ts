import express from 'express';
import { ContextFactories } from 'src/types/graphql';
import { createMCPRouter } from "./mcp";

export function appendMCPRoutes(app: express.Application, factories: ContextFactories): void {
  const router = createMCPRouter(factories);

  app.use('/integration/mcp', router);
}
