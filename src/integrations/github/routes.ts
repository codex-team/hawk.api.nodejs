import express from 'express';
import { v4 as uuid } from 'uuid';
import { ObjectId } from 'mongodb';
import { GitHubService } from './service';
import { ContextFactories } from '../../types/graphql';
import { RedisInstallStateStore } from './store/install-state.redis.store';
import WorkspaceModel from '../../models/workspace';

/**
 * Create GitHub router
 *
 * @param factories - context factories for database access
 * @returns Express router with GitHub integration endpoints
 */
export function createGitHubRouter(factories: ContextFactories): express.Router {
  const router = express.Router();
  const githubService = new GitHubService();
  const stateStore = new RedisInstallStateStore();

  /**
   * GET /integration/github/connect?projectId=<projectId>
   * Initiate GitHub integration connection
   */
  router.get('/connect', async (req, res, next) => {
    try {
      const { projectId } = req.query;
      const userId = req.context?.user?.id;

      /**
       * Check if user is authenticated
       */
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized. Please provide authorization token.' });

        return;
      }

      /**
       * Validate projectId parameter
       */
      if (!projectId || typeof projectId !== 'string') {
        res.status(400).json({ error: 'projectId query parameter is required' });

        return;
      }

      /**
       * Validate projectId format (MongoDB ObjectId)
       */
      if (!ObjectId.isValid(projectId)) {
        res.status(400).json({ error: `Invalid projectId format: ${projectId}` });

        return;
      }

      /**
       * Find project by ID
       */
      const project = await factories.projectsFactory.findById(projectId);

      if (!project) {
        res.status(404).json({ error: `Project not found: ${projectId}` });

        return;
      }

      /**
       * Check if project is demo project (cannot be modified)
       */
      if (project.workspaceId.toString() === '6213b6a01e6281087467cc7a') {
        res.status(400).json({ error: 'Unable to update demo project' });

        return;
      }

      /**
       * Get workspace to check admin permissions
       */
      const workspace = await factories.workspacesFactory.findById(project.workspaceId.toString());

      if (!workspace) {
        res.status(404).json({ error: `Workspace not found: ${project.workspaceId.toString()}` });

        return;
      }

      /**
       * Check if user is member of workspace
       */
      const member = await workspace.getMemberInfo(userId);

      if (!member || WorkspaceModel.isPendingMember(member)) {
        res.status(403).json({ error: 'You are not a member of this workspace' });

        return;
      }

      /**
       * Check if user is admin of workspace
       */
      if (!member.isAdmin) {
        res.status(403).json({ error: 'Not enough permissions. Only workspace admin can connect Task Manager integration.' });

        return;
      }

      /**
       * Generate unique state for CSRF protection
       * Using UUID v4 for simplicity (alternative: JWT token)
       */
      const state = uuid();

      /**
       * Save state data in Redis with TTL
       * Data includes: projectId, userId, timestamp
       */
      const stateData = {
        projectId,
        userId,
        timestamp: Date.now(),
      };

      await stateStore.saveState(state, stateData);

      console.log(
        `[GitHub Integration] Created state for project ${projectId}: ${state.slice(0, 8)}...`
      );

      /**
       * Generate GitHub installation URL with state
       */
      const installationUrl = githubService.getInstallationUrl(state);

      console.log(
        `[GitHub Integration] Redirecting to GitHub installation URL for project ${projectId}`
      );

      /**
       * Redirect user to GitHub installation page
       */
      res.redirect(installationUrl);
    } catch (error) {
      console.error('[GitHub Integration] Error in /connect endpoint:', error);
      next(error);
    }
  });

  return router;
}
