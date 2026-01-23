import express from 'express';
import { createGitHubRouter } from './routes';
import { ContextFactories } from '../../types/graphql';

/**
 * Re-export types and service from service.ts for backward compatibility
 */
export { GitHubService, IssueData, GitHubIssue, Installation, Repository } from './service';

/**
 * Append GitHub routes to Express app
 *
 * @param app - Express application instance
 * @param factories - context factories for database access
 */
export function appendGitHubRoutes(app: express.Application, factories: ContextFactories): void {
  const githubRouter = createGitHubRouter(factories);

  app.use('/integration/github', githubRouter);
}
