import express from 'express';
import { createSamlRouter } from './saml';
import { ContextFactories } from '../types/graphql';

/**
 * Append SSO routes to Express app
 *
 * @param app - Express application instance
 * @param factories - context factories for database access
 */
export function appendSsoRoutes(app: express.Application, factories: ContextFactories): void {
  const samlRouter = createSamlRouter(factories);
  app.use('/auth/sso/saml', samlRouter);
}

