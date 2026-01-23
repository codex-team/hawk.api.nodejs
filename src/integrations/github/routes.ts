import '../../typeDefs/expressContext';
import express from 'express';
import { v4 as uuid } from 'uuid';
import { ObjectId } from 'mongodb';
import { createHmac } from 'crypto';
import { GitHubService } from './service';
import { ContextFactories } from '../../types/graphql';
import { RedisInstallStateStore } from './store/install-state.redis.store';
import WorkspaceModel from '../../models/workspace';
import { sgr, Effect } from '../../utils/ansi';
import { databases } from '../../mongo';

/**
 * Create GitHub router
 *
 * @param factories - context factories for database access
 * @returns Express router with GitHub integration endpoints
 */
/**
 * Default task threshold for automatic task creation
 * Minimum totalCount required to trigger auto-task creation
 */
const DEFAULT_TASK_THRESHOLD_TOTAL_COUNT = 50;

export function createGitHubRouter(factories: ContextFactories): express.Router {
  const router = express.Router();
  const githubService = new GitHubService();
  const stateStore = new RedisInstallStateStore();

  /**
   * Build redirect URL to Garage frontend
   *
   * @param path - path on Garage (e.g., '/project/123/settings/task-manager')
   * @param params - URL search parameters (e.g., { success: 'true' } or { error: 'message' })
   * @returns Full URL string for redirect
   */
  function buildGarageRedirectUrl(path: string, params?: Record<string, string>): string {
    const garageUrl = process.env.GARAGE_URL || 'https://garage.hawk.so';
    const redirectUrl = new URL(path, garageUrl);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        redirectUrl.searchParams.set(key, value);
      }
    }

    return redirectUrl.toString();
  }

  /**
   * Validate project access and admin permissions
   * Performs common checks: authentication, projectId validation, project existence, workspace membership, admin rights
   *
   * @param req - Express request object
   * @param res - Express response object
   * @param projectId - project ID from query parameters
   * @param errorMessagePrefix - prefix for admin permission error message (e.g., "connect Task Manager integration")
   * @returns Object with project, workspace, and userId if validation passes, null otherwise (response already sent)
   */
  async function validateProjectAdminAccess(
    req: express.Request,
    res: express.Response,
    projectId: string | undefined,
    errorMessagePrefix: string = 'perform this action'
  ): Promise<{ project: any; workspace: any; userId: string } | null> {
    const userId = req.context?.user?.id;

    /**
     * Check if user is authenticated
     */
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized. Please provide authorization token.' });

      return null;
    }

    /**
     * Validate projectId parameter
     */
    if (!projectId || typeof projectId !== 'string') {
      res.status(400).json({ error: 'projectId query parameter is required' });

      return null;
    }

    /**
     * Validate projectId format (MongoDB ObjectId)
     */
    if (!ObjectId.isValid(projectId)) {
      res.status(400).json({ error: `Invalid projectId format: ${projectId}` });

      return null;
    }

    /**
     * Find project by ID
     */
    const project = await factories.projectsFactory.findById(projectId);

    if (!project) {
      res.status(404).json({ error: `Project not found: ${projectId}` });

      return null;
    }

    /**
     * Check if project is demo project (cannot be modified)
     */
    if (project.workspaceId.toString() === '6213b6a01e6281087467cc7a') {
      res.status(400).json({ error: 'Unable to update demo project' });

      return null;
    }

    /**
     * Get workspace to check admin permissions
     */
    const workspace = await factories.workspacesFactory.findById(project.workspaceId.toString());

    if (!workspace) {
      res.status(404).json({ error: `Workspace not found: ${project.workspaceId.toString()}` });

      return null;
    }

    /**
     * Check if user is member of workspace
     */
    const member = await workspace.getMemberInfo(userId);

    if (!member || WorkspaceModel.isPendingMember(member)) {
      res.status(403).json({ error: 'You are not a member of this workspace' });

      return null;
    }

    /**
     * Check if user is admin of workspace
     */
    if (!member.isAdmin) {
      res.status(403).json({ error: `Not enough permissions. Only workspace admin can ${errorMessagePrefix}.` });

      return null;
    }

    return { project, workspace, userId };
  }

  /**
   * Log message with GitHub Integration prefix
   *
   * @param level - log level ('log', 'warn', 'error', 'info')
   * @param projectId - optional project ID to include in log prefix
   * @param args - arguments to log
   */
  function log(level: 'log' | 'warn' | 'error' | 'info', projectIdOrFirstArg?: string | unknown, ...args: unknown[]): void {
    /**
     * Disable logging in test environment
     */
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const colors = {
      log: Effect.ForegroundGreen,
      warn: Effect.ForegroundYellow,
      error: Effect.ForegroundRed,
      info: Effect.ForegroundBlue,
    };

    let logger: typeof console.log;

    if (level === 'error') {
      logger = console.error;
    } else if (level === 'warn') {
      logger = console.warn;
    } else {
      logger = console.log;
    }

    /**
     * Check if first argument is projectId (string) or regular log argument
     * projectId should be a string and valid ObjectId format
     */
    let projectId: string | undefined;
    let logArgs: unknown[];

    if (typeof projectIdOrFirstArg === 'string' && ObjectId.isValid(projectIdOrFirstArg)) {
      projectId = `pid: ${projectIdOrFirstArg}`;
      logArgs = args;
    } else {
      logArgs = projectIdOrFirstArg !== undefined ? [projectIdOrFirstArg, ...args] : args;
    }

    /**
     * Build log prefix with optional projectId
     */
    const prefix = projectId
      ? `${sgr('[GitHub Integration]', colors[level])} ${sgr(`[${projectId}]`, Effect.ForegroundCyan)}`
      : sgr('[GitHub Integration]', colors[level]);

    logger(prefix, ...logArgs);
  }

  /**
   * GET /integration/github/connect?projectId=<projectId>
   * Initiate GitHub integration connection
   */
  router.get('/connect', async (req, res, next) => {
    try {
      const { projectId } = req.query;

      /**
       * Validate project access and admin permissions
       */
      const access = await validateProjectAdminAccess(req, res, projectId as string | undefined, 'connect Task Manager integration');

      if (!access) {
        return;
      }

      const { project, userId } = access;
      const validatedProjectId = project._id.toString();

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
        projectId: validatedProjectId,
        userId,
        timestamp: Date.now(),
      };

      await stateStore.saveState(state, stateData);

      log('info', validatedProjectId, `Created state: ${sgr(state.slice(0, 8), Effect.ForegroundGray)}...`);

      /**
       * Generate GitHub installation URL with state
       */
      const installationUrl = githubService.getInstallationUrl(state);

      log('info', validatedProjectId, 'Generated GitHub installation URL: ' + sgr(installationUrl, Effect.ForegroundGreen));

      /**
       * Return installation URL in JSON response
       * Frontend will handle the redirect using window.location.href
       * This allows Authorization header to be sent correctly
       */
      res.json({
        redirectUrl: installationUrl,
      });
    } catch (error) {
      log('error', 'Error in /connect endpoint:', error);
      next(error);
    }
  });

  /**
   * GET /integration/github/callback?state=<state>&installation_id=<installation_id>
   * Handle GitHub App installation callback
   */
  router.get('/callback', async (req, res, next) => {
    try {
      const { state, installation_id } = req.query;

      /**
       * Log callback request for debugging
       */
      log('info', `Callback received: state=${state}, installation_id=${installation_id}, query=${JSON.stringify(req.query)}`);

      /**
       * Validate required parameters
       */
      if (!state || typeof state !== 'string') {
        return res.redirect(buildGarageRedirectUrl('/project/error/settings/task-manager', {
          error: 'Missing or invalid state',
        }));
      }

      if (!installation_id || typeof installation_id !== 'string') {
        return res.redirect(buildGarageRedirectUrl('/project/error/settings/task-manager', {
          error: 'Missing or invalid installation_id parameter',
        }));
      }

      /**
       * Verify state (CSRF protection)
       * getState() atomically gets and deletes the state, preventing reuse
       */
      const stateData = await stateStore.getState(state);

      if (!stateData) {
        log('warn', `Invalid or expired state: ${sgr(state.slice(0, 8), Effect.ForegroundGray)}...`);

        return res.redirect(buildGarageRedirectUrl('/project/error/settings/task-manager', {
          error: 'Invalid or expired state. Please try connecting again.',
        }));
      }

      const { projectId, userId } = stateData;

      log('info', projectId, `Processing callback initiated by user ${sgr(userId, Effect.ForegroundCyan)}`);

      /**
       * Verify project exists
       */
      const project = await factories.projectsFactory.findById(projectId);

      if (!project) {
        log('error', projectId, 'Project not found');

        return res.redirect(buildGarageRedirectUrl('/project/error/settings/task-manager', {
          error: `Project not found: ${projectId}`,
        }));
      }

      /**
       * Get installation info from GitHub
       */
      let installation;

      try {
        installation = await githubService.getInstallationForRepository(installation_id);
        log('info', projectId, `Retrieved installation info for installation_id: ${sgr(installation_id, Effect.ForegroundCyan)}`);
      } catch (error) {
        log('error', projectId, `Failed to get installation info: ${error instanceof Error ? error.message : String(error)}`);

        return res.redirect(buildGarageRedirectUrl(`/project/${projectId}/settings/task-manager`, {
          error: 'Failed to retrieve GitHub installation information. Please try again.',
        }));
      }

      /**
       * For now, we save only installationId
       * repoId and repoFullName will be set when creating the first issue or can be configured later
       * GitHub App installation can include multiple repositories, so we don't know which one to use yet
       */
      const taskManagerConfig = {
        type: 'github',
        autoTaskEnabled: false,
        taskThresholdTotalCount: DEFAULT_TASK_THRESHOLD_TOTAL_COUNT,
        assignAgent: false,
        connectedAt: new Date(),
        updatedAt: new Date(),
        config: {
          installationId: installation_id,
          repoId: '',
          repoFullName: '',
        },
      };

      let successRedirectUrl = buildGarageRedirectUrl(`/project/${projectId}/settings/task-manager`, {
        success: 'true',
      });

      /**
       * Save taskManager configuration to project
       */
      try {
        await project.updateProject(({
          taskManager: taskManagerConfig,
        }) as any);

        log('info', projectId, 'Successfully connected GitHub integration. Redirecting to ' + sgr(successRedirectUrl, Effect.ForegroundGreen));
      } catch (error) {
        log('error', projectId, `Failed to save taskManager config: ${error instanceof Error ? error.message : String(error)}`);

        return res.redirect(buildGarageRedirectUrl(`/project/${projectId}/settings/task-manager`, {
          error: 'Failed to save Task Manager configuration. Please try again.',
        }));
      }

      /**
       * Redirect to Garage with success parameter
       */
      return res.redirect(successRedirectUrl);
    } catch (error) {
      log('error', 'Error in /callback endpoint:', error);
      next(error);
    }
  });

  /**
   * POST /integration/github/webhook
   * Handle GitHub App webhook events
   */
  router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res, next) => {
    try {
      /**
       * Get webhook secret from environment
       */
      const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

      if (!webhookSecret) {
        log('error', 'GITHUB_WEBHOOK_SECRET is not configured');
        res.status(500).json({ error: 'Webhook secret not configured' });

        return;
      }

      /**
       * Get signature from request headers
       * GitHub sends signature in X-Hub-Signature-256 header as sha256=<signature>
       */
      const signature = req.headers['x-hub-signature-256'] as string | undefined;

      if (!signature) {
        log('warn', 'Missing X-Hub-Signature-256 header');

        return res.status(401).json({ error: 'Missing signature header' });
      }

      /**
       * Verify webhook signature using HMAC SHA-256
       */
      const payload = req.body as Buffer;
      const hmac = createHmac('sha256', webhookSecret);
      hmac.update(payload as any);
      const calculatedSignature = `sha256=${hmac.digest('hex')}`;

      /**
       * Use timing-safe comparison to prevent timing attacks
       */
      let signatureValid = false;

      if (signature.length === calculatedSignature.length) {
        let match = true;

        for (let i = 0; i < signature.length; i++) {
          if (signature[i] !== calculatedSignature[i]) {
            match = false;
          }
        }

        signatureValid = match;
      }

      if (!signatureValid) {
        log('warn', 'Invalid webhook signature');

        return res.status(401).json({ error: 'Invalid signature' });
      }

      /**
       * Parse webhook payload
       */
      let payloadData: any;

      try {
        payloadData = JSON.parse(payload.toString());
      } catch (error) {
        log('error', 'Failed to parse webhook payload:', error);

        return res.status(400).json({ error: 'Invalid JSON payload' });
      }

      const eventType = req.headers['x-github-event'] as string | undefined;
      const installationId = payloadData.installation?.id?.toString();

      log('info', `Received webhook event: ${sgr(eventType || 'unknown', Effect.ForegroundCyan)}`);

      /**
       * Handle installation.deleted event
       */
      if (eventType === 'installation' && payloadData.action === 'deleted') {
        if (!installationId) {
          log('warn', 'installation.deleted event received but installation_id is missing');

          return res.status(200).json({ message: 'Event received but no installation_id provided' });
        }

        log('info', `Processing installation.deleted for installation_id: ${sgr(installationId, Effect.ForegroundCyan)}`);

        /**
         * Find all projects with this installationId
         * Using MongoDB query directly as projectsFactory doesn't have a method for this
         */
        const projectsCollection = databases.hawk?.collection('projects');

        if (!projectsCollection) {
          log('error', 'MongoDB projects collection is not available');

          return res.status(500).json({ error: 'Database connection error' });
        }

        try {
          const projects = await projectsCollection
            .find({
              'taskManager.config.installationId': installationId,
            })
            .toArray();

          log('info', `Found ${sgr(projects.length.toString(), Effect.ForegroundCyan)} project(s) with installation_id ${installationId}`);

          /**
           * Remove taskManager configuration from all projects
           */
          if (projects.length > 0) {
            const projectIds = projects.map((p) => p._id.toString());

            await projectsCollection.updateMany(
              {
                'taskManager.config.installationId': installationId,
              },
              {
                $unset: {
                  taskManager: '',
                },
                $set: {
                  updatedAt: new Date(),
                },
              }
            );

            log('info', `Removed taskManager configuration from ${sgr(projects.length.toString(), Effect.ForegroundCyan)} project(s): ${projectIds.join(', ')}`);
          }
        } catch (error) {
          log('error', `Failed to remove taskManager configurations: ${error instanceof Error ? error.message : String(error)}`);

          return res.status(500).json({ error: 'Failed to process installation.deleted event' });
        }
      } else {
        /**
         * Log other events for monitoring
         */
        log('info', `Unhandled webhook event: ${sgr(eventType || 'unknown', Effect.ForegroundGray)} (action: ${sgr(payloadData.action || 'unknown', Effect.ForegroundGray)})`);
      }

      /**
       * Return 200 OK for successful processing
       */
      res.status(200).json({ message: 'Webhook processed successfully' });
    } catch (error) {
      log('error', 'Error in /webhook endpoint:', error);
      next(error);
    }
  });

  /**
   * GET /integration/github/repositories?projectId=<projectId>
   * Get list of repositories accessible to GitHub App installation
   */
  router.get('/repositories', async (req, res, next) => {
    try {
      const { projectId } = req.query;

      /**
       * Validate project access and admin permissions
       */
      const access = await validateProjectAdminAccess(req, res, projectId as string | undefined, 'access repository list');

      if (!access) {
        return;
      }

      const { project } = access;

      /**
       * Check if taskManager is configured
       */
      const taskManager = (project as any).taskManager;

      if (!taskManager) {
        res.status(400).json({ error: 'Task Manager is not configured for this project' });

        return;
      }

      /**
       * Extract installationId from project configuration
       */
      const installationId = taskManager.config.installationId;

      if (!installationId) {
        res.status(400).json({ error: 'GitHub installation ID is not configured for this project' });

        return;
      }

      /**
       * Get list of repositories from GitHub
       */
      try {
        const repositories = await githubService.getRepositoriesForInstallation(installationId);

        /**
         * Log repository details for debugging
         */
        const repoOwners = [...new Set(repositories.map((r) => r.fullName.split('/')[0]))];
        log('info', projectId, `Retrieved ${repositories.length} repository(ies) for installation ${installationId}`);
        log('info', projectId, `Repository owners: ${repoOwners.join(', ')}`);

        res.json({
          repositories,
        });
      } catch (error) {
        log('error', projectId, `Failed to get repositories: ${error instanceof Error ? error.message : String(error)}`);

        res.status(500).json({
          error: 'Failed to retrieve repositories from GitHub. Please try again.',
        });
      }
    } catch (error) {
      log('error', 'Error in /repositories endpoint:', error);
      next(error);
    }
  });

  /**
   * PUT /integration/github/repository?projectId=<projectId>
   * Update selected repository for GitHub App installation
   */
  router.put('/repository', async (req, res, next) => {
    try {
      const { projectId } = req.query;
      const { repoId, repoFullName } = req.body;

      /**
       * Validate project access and admin permissions
       */
      const access = await validateProjectAdminAccess(req, res, projectId as string | undefined, 'update repository selection');

      if (!access) {
        return;
      }

      const { project } = access;
      const validatedProjectId = project._id.toString();

      /**
       * Validate request body
       */
      if (!repoId || typeof repoId !== 'string') {
        res.status(400).json({ error: 'repoId is required and must be a string' });

        return;
      }

      if (!repoFullName || typeof repoFullName !== 'string') {
        res.status(400).json({ error: 'repoFullName is required and must be a string' });

        return;
      }

      /**
       * Check if taskManager is configured
       */
      const taskManager = (project as any).taskManager;

      if (!taskManager) {
        res.status(400).json({ error: 'Task Manager is not configured for this project' });

        return;
      }

      /**
       * Update taskManager config with selected repository
       */
      const updatedTaskManager = {
        ...taskManager,
        config: {
          ...taskManager.config,
          repoId,
          repoFullName,
        },
        updatedAt: new Date(),
      };

      try {
        await project.updateProject({
          taskManager: updatedTaskManager,
        } as any);

        log('info', validatedProjectId, `Updated repository selection: ${repoFullName} (${repoId})`);

        res.json({
          success: true,
          message: 'Repository selection updated successfully',
        });
      } catch (error) {
        log('error', validatedProjectId, `Failed to update repository selection: ${error instanceof Error ? error.message : String(error)}`);

        res.status(500).json({
          error: 'Failed to update repository selection. Please try again.',
        });
      }
    } catch (error) {
      log('error', 'Error in /repository endpoint:', error);
      next(error);
    }
  });

  return router;
}
