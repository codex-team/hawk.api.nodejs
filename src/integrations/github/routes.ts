import '../../typeDefs/expressContext';
import express from 'express';
import { v4 as uuid } from 'uuid';
import { ObjectId } from 'mongodb';
import { createHmac, timingSafeEqual } from 'crypto';
import { GitHubService } from '@hawk.so/github-sdk';
import { ProjectDBScheme, GitHubInstallation } from '@hawk.so/types';
import { ContextFactories } from '../../types/graphql';
import { RedisInstallStateStore } from './store/install-state.redis.store';
import ProjectModel from '../../models/project';
import WorkspaceModel from '../../models/workspace';
import UserModel from '../../models/user';
import { sgr, Effect } from '../../utils/ansi';
import { databases } from '../../mongo';

/**
 * Default task threshold for automatic task creation
 * Minimum totalCount required to trigger auto-task creation
 */
const DEFAULT_TASK_THRESHOLD_TOTAL_COUNT = 50;

/**
 * Create GitHub router
 *
 * @param factories - context factories for database access
 * @returns Express router with GitHub integration endpoints
 */
export function createGitHubRouter(factories: ContextFactories): express.Router {
  const router = express.Router();

  if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_PRIVATE_KEY) {
    throw new Error('GITHUB_APP_ID and GITHUB_PRIVATE_KEY environment variables are required');
  }

  const githubService = new GitHubService({
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_PRIVATE_KEY,
    appSlug: process.env.GITHUB_APP_SLUG,
    clientId: process.env.GITHUB_APP_CLIENT_ID,
    clientSecret: process.env.GITHUB_APP_CLIENT_SECRET,
    apiUrl: process.env.API_URL,
  });

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
    errorMessagePrefix = 'perform this action'
  ): Promise<{ project: ProjectModel; workspace: WorkspaceModel; userId: string } | null> {
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

    return {
      project,
      workspace,
      userId,
    };
  }

  /**
   * Validate workspace access and admin permissions
   *
   * @param req - Express request object
   * @param res - Express response object
   * @param workspaceId - workspace ID from query parameters
   * @param errorMessagePrefix - prefix for admin permission error message
   * @returns Object with workspace and userId if validation passes, null otherwise (response already sent)
   */
  async function validateWorkspaceAdminAccess(
    req: express.Request,
    res: express.Response,
    workspaceId: string | undefined,
    errorMessagePrefix = 'perform this action'
  ): Promise<{ workspace: WorkspaceModel; userId: string } | null> {
    const userId = req.context?.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized. Please provide authorization token.' });

      return null;
    }

    if (!workspaceId || typeof workspaceId !== 'string') {
      res.status(400).json({ error: 'workspaceId query parameter is required' });

      return null;
    }

    if (!ObjectId.isValid(workspaceId)) {
      res.status(400).json({ error: `Invalid workspaceId format: ${workspaceId}` });

      return null;
    }

    const workspace = await factories.workspacesFactory.findById(workspaceId);

    if (!workspace) {
      res.status(404).json({ error: `Workspace not found: ${workspaceId}` });

      return null;
    }

    const member = await workspace.getMemberInfo(userId);

    if (!member || WorkspaceModel.isPendingMember(member)) {
      res.status(403).json({ error: 'You are not a member of this workspace' });

      return null;
    }

    if (!member.isAdmin) {
      res.status(403).json({ error: `Not enough permissions. Only workspace admin can ${errorMessagePrefix}.` });

      return null;
    }

    return {
      workspace,
      userId,
    };
  }

  /**
   * Log message with GitHub Integration prefix
   *
   * @param level - log level ('log', 'warn', 'error', 'info')
   * @param projectIdOrFirstArg - optional project ID to include in log prefix, or first log argument if not a valid ObjectId
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

  const WEBHOOK_LOG_PREFIX = '[🍏 🍎 ✨ Webhook] ';

  /**
   * GET /integration/github/connect?workspaceId=<workspaceId>&projectId=<projectId>
   * Initiate GitHub integration connection.
   *
   * If workspace already has installations → returns them so frontend can show repo picker directly.
   * If workspace has no installations → returns GitHub install URL for redirect.
   */
  router.get('/connect', async (req, res, next) => {
    try {
      const { workspaceId, projectId } = req.query;

      /**
       * Validate projectId — connection is always initiated from a project settings page
       */
      if (!projectId || typeof projectId !== 'string' || !ObjectId.isValid(projectId)) {
        res.status(400).json({ error: 'projectId query parameter is required' });

        return;
      }

      /**
       * Validate workspace access and admin permissions
       */
      const access = await validateWorkspaceAdminAccess(req, res, workspaceId as string | undefined, 'connect Task Manager integration');

      if (!access) {
        return;
      }

      const { workspace, userId } = access;
      const validatedWorkspaceId = workspace._id.toString();

      /**
       * Check if workspace already has GitHub installations.
       * If yes, return them so the frontend can show repo picker directly.
       */
      const existingInstallations = workspace.getGitHubInstallations();

      if (existingInstallations.length > 0) {
        log('info', `Workspace ${validatedWorkspaceId} already has ${existingInstallations.length} installation(s), returning them`);

        return res.json({
          hasInstallations: true,
          installations: existingInstallations.map((i) => ({
            installationId: i.installationId,
            account: i.account,
          })),
        });
      }

      /**
       * No installations — generate GitHub App install URL
       */
      const state = uuid();

      const stateData = {
        workspaceId: validatedWorkspaceId,
        projectId,
        userId,
        timestamp: Date.now(),
      };

      await stateStore.saveState(state, stateData);

      log('info', `Created state for workspace ${validatedWorkspaceId}: ${sgr(state.slice(0, 8), Effect.ForegroundGray)}...`);

      const installationUrl = githubService.getInstallationUrl(state);

      log('info', `Generated GitHub installation URL: ${sgr(installationUrl, Effect.ForegroundGreen)}`);

      res.json({
        hasInstallations: false,
        redirectUrl: installationUrl,
      });
    } catch (error) {
      log('error', 'Error in /connect endpoint:', error);
      next(error);
    }
  });

  /**
   * GET /integration/github/oauth?code=<code>&state=<state>&installation_id=<installation_id>
   * Handle GitHub OAuth callback.
   *
   * Called by GitHub after the user completes the GitHub App installation + OAuth authorization flow.
   * GitHub redirects here with `code` (OAuth authorization code), `state` (CSRF token),
   * and optionally `installation_id` (present when a new GitHub App installation was created).
   *
   * This endpoint:
   * 1. If installation_id is present — saves the installation to workspace.integrations.github.installations[]
   * 2. Exchanges the OAuth code for tokens and saves refreshToken to user.githubAuthorizations[]
   * 3. Redirects back to Garage project settings page
   */
  router.get('/oauth', async (req, res, next) => {
    try {
      // eslint-disable-next-line @typescript-eslint/camelcase, camelcase
      const { code, state, installation_id } = req.query;

      // eslint-disable-next-line @typescript-eslint/camelcase, camelcase
      log('info', `OAuth callback received: state=${state}, code=${code ? 'present' : 'missing'}, installation_id=${installation_id ? 'present' : 'missing'}`);

      if (!code || typeof code !== 'string') {
        return res.redirect(buildGarageRedirectUrl('/', {
          apiError: 'Missing or invalid OAuth code',
        }));
      }

      if (!state || typeof state !== 'string') {
        return res.redirect(buildGarageRedirectUrl('/', {
          apiError: 'Missing or invalid state',
        }));
      }

      /**
       * Verify state (CSRF protection)
       */
      const stateData = await stateStore.getState(state);

      if (!stateData) {
        log('warn', `Invalid or expired state: ${sgr(state.slice(0, 8), Effect.ForegroundGray)}...`);

        return res.redirect(buildGarageRedirectUrl('/', {
          apiError: 'Invalid or expired state. Please try connecting again.',
        }));
      }

      const { workspaceId, projectId, userId } = stateData;

      log('info', `Processing OAuth callback for workspace ${sgr(workspaceId, Effect.ForegroundCyan)}, initiated by user ${sgr(userId, Effect.ForegroundCyan)}`);

      /**
       * Verify workspace exists
       */
      const workspace = await factories.workspacesFactory.findById(workspaceId);

      if (!workspace) {
        log('error', `Workspace not found: ${workspaceId}`);

        return res.redirect(buildGarageRedirectUrl('/', {
          apiError: `Workspace not found: ${workspaceId}`,
        }));
      }

      const redirectPath = `/project/${projectId}/settings/task-manager`;

      /**
       * If installation_id is present, save installation to workspace
       */
      // eslint-disable-next-line @typescript-eslint/camelcase, camelcase
      if (installation_id && typeof installation_id === 'string') {
        // eslint-disable-next-line @typescript-eslint/camelcase, camelcase
        const installId = parseInt(installation_id, 10);

        log('info', `GitHub App installation detected (installation_id: ${installation_id}), saving to workspace`);

        /**
         * Check if this installation already exists in the workspace
         */
        const existingInstallation = workspace.findGitHubInstallation(installId);

        if (!existingInstallation) {
          /**
           * Get installation metadata from GitHub
           */
          let installationInfo;

          try {
            // eslint-disable-next-line @typescript-eslint/camelcase, camelcase
            installationInfo = await githubService.getInstallationForRepository(installation_id);
          } catch (error) {
            log('error', `Failed to get installation info: ${error instanceof Error ? error.message : String(error)}`);

            return res.redirect(buildGarageRedirectUrl(redirectPath, {
              error: 'Failed to retrieve GitHub installation information. Please try again.',
            }));
          }

          const newInstallation: GitHubInstallation = {
            installationId: installId,
            account: {
              id: installationInfo.account?.id ?? 0,
              login: installationInfo.account?.login ?? 'unknown',
              type: installationInfo.target_type === 'Organization' ? 'Organization' : 'User',
            },
            connectedByHawkUserId: userId,
            connectedAt: new Date(),
            updatedAt: new Date(),
            delegatedUser: null,
          };

          try {
            await workspace.addGitHubInstallation(newInstallation);
            log('info', `Saved installation ${installId} to workspace ${workspaceId}`);
          } catch (error) {
            log('error', `Failed to save installation to workspace: ${error instanceof Error ? error.message : String(error)}`);

            return res.redirect(buildGarageRedirectUrl(redirectPath, {
              error: 'Failed to save installation. Please try again.',
            }));
          }
        } else {
          log('info', `Installation ${installId} already exists in workspace ${workspaceId}, skipping`);
        }
      }

      /**
       * Exchange OAuth code for user-to-server token
       */
      let tokenData;

      try {
        tokenData = await githubService.exchangeOAuthCodeForToken(code);
        log('info', `Successfully exchanged OAuth code for user ${sgr(tokenData.user.login, Effect.ForegroundCyan)}`);
      } catch (error) {
        log('error', `Failed to exchange OAuth code: ${error instanceof Error ? error.message : String(error)}`);

        return res.redirect(buildGarageRedirectUrl(redirectPath, {
          error: 'Failed to exchange OAuth code for token. Please try again.',
        }));
      }

      /**
       * Save OAuth tokens to user.githubAuthorizations[] (NOT to project)
       */
      try {
        const user = await factories.usersFactory.findById(userId) as UserModel | null;

        if (!user) {
          log('error', `User not found: ${userId}`);

          return res.redirect(buildGarageRedirectUrl(redirectPath, {
            error: 'User not found during OAuth callback.',
          }));
        }

        await user.upsertGitHubAuthorization({
          githubUserId: tokenData.user.id,
          githubLogin: tokenData.user.login,
          refreshToken: tokenData.refreshToken,
          refreshTokenExpiresAt: tokenData.refreshTokenExpiresAt,
          tokenCreatedAt: new Date(),
          tokenLastValidatedAt: new Date(),
          status: 'active',
        });

        log('info', `Saved GitHub authorization for user ${sgr(tokenData.user.login, Effect.ForegroundCyan)}`);

        /**
         * Update delegatedUser in workspace installation if we just created one
         */
        // eslint-disable-next-line @typescript-eslint/camelcase, camelcase
        if (installation_id && typeof installation_id === 'string') {
          // eslint-disable-next-line @typescript-eslint/camelcase, camelcase
          const installId = parseInt(installation_id, 10);

          await databases.hawk?.collection('workspaces')!.updateOne(
            {
              _id: new ObjectId(workspaceId),
              'integrations.github.installations.installationId': installId,
            },
            {
              $set: {
                'integrations.github.installations.$.delegatedUser': {
                  hawkUserId: userId,
                  githubUserId: tokenData.user.id,
                  githubLogin: tokenData.user.login,
                  status: 'active',
                },
                'integrations.github.installations.$.updatedAt': new Date(),
              },
            }
          );
        }
      } catch (error) {
        log('error', `Failed to save GitHub authorization: ${error instanceof Error ? error.message : String(error)}`);

        return res.redirect(buildGarageRedirectUrl(redirectPath, {
          error: 'Failed to save OAuth token. Please try again.',
        }));
      }

      /**
       * Redirect to Garage with success parameter
       */
      const successRedirectUrl = buildGarageRedirectUrl(redirectPath, {
        success: 'true',
      });

      log('info', 'OAuth authorization completed successfully. Redirecting to ' + sgr(successRedirectUrl, Effect.ForegroundGreen));

      return res.redirect(successRedirectUrl);
    } catch (error) {
      log('error', 'Error in /oauth endpoint:', error);
      next(error);
    }
  });

  /**
   * POST /integration/github/webhook
   * Handle GitHub App webhook events
   *
   * GitHub delivers signed webhook payloads as POST requests.
   * For non-POST methods (e.g. GET/HEAD checks), respond with 200 without signature validation.
   */
  router.all('/webhook', express.raw({ type: 'application/json' }), async (req, res, next) => {
    log('info', `${WEBHOOK_LOG_PREFIX}/webhook route called with method ${req.method}`);

    /**
     * For non-POST methods (for example, GitHub hitting Setup URL or doing health checks),
     * just log query parameters and respond with 200 without signature validation.
     */
    if (req.method !== 'POST') {
      // eslint-disable-next-line @typescript-eslint/camelcase, camelcase
      const { code, installation_id, setup_action, state, ...restQuery } = req.query as Record<string, unknown>;

      // eslint-disable-next-line @typescript-eslint/camelcase, camelcase
      if (code || installation_id || state || setup_action) {
        log('info', `${WEBHOOK_LOG_PREFIX}Received non-POST request on /webhook with OAuth-like params`, {
          code,
          installation_id, // eslint-disable-line @typescript-eslint/camelcase, camelcase
          setup_action, // eslint-disable-line @typescript-eslint/camelcase, camelcase
          state,
          query: restQuery,
        });
      } else {
        log('info', `${WEBHOOK_LOG_PREFIX}Received non-POST request on /webhook without signature (likely a health check or misconfigured URL)`, {
          query: req.query,
        });
      }

      return res.status(200).json({ ok: true });
    }

    try {
      /**
       * Get webhook secret from environment
       */
      const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

      if (!webhookSecret) {
        log('error', `${WEBHOOK_LOG_PREFIX}GITHUB_WEBHOOK_SECRET is not configured`);
        res.status(500).json({ error: 'Webhook secret not configured' });

        return;
      }

      /**
       * Get signature from request headers
       * GitHub sends signature in X-Hub-Signature-256 header as sha256=<signature>
       */
      const signature = req.headers['x-hub-signature-256'] as string | undefined;

      if (!signature) {
        log('warn', `${WEBHOOK_LOG_PREFIX}Missing X-Hub-Signature-256 header`);

        return res.status(401).json({ error: 'Missing signature header' });
      }

      /**
       * Verify webhook signature using HMAC SHA-256
       */
      const payload = req.body as Buffer;
      const hmac = createHmac('sha256', webhookSecret);

      hmac.update(payload.toString('binary'), 'binary');
      const calculatedSignature = `sha256=${hmac.digest('hex')}`;

      /**
       * Use timing-safe comparison to prevent timing attacks
       * timingSafeEqual requires both arguments to be Buffer or Uint8Array of the same length
       */
      let signatureValid = false;

      if (signature.length === calculatedSignature.length) {
        try {
          const signatureBuffer = Buffer.from(signature);
          const calculatedBuffer = Buffer.from(calculatedSignature);

          signatureValid = timingSafeEqual(
            signatureBuffer as Uint8Array,
            calculatedBuffer as Uint8Array
          );
        } catch (error) {
          /**
           * timingSafeEqual throws if buffers have different lengths
           * This shouldn't happen due to the length check above, but handle it gracefully
           */
          signatureValid = false;
        }
      }

      if (!signatureValid) {
        log('warn', `${WEBHOOK_LOG_PREFIX}Invalid webhook signature`);

        return res.status(401).json({ error: 'Invalid signature' });
      }

      /**
       * Parse webhook payload
       */
      type GitHubWebhookPayload = { installation?: { id?: number | string }; action?: string };

      let payloadData: GitHubWebhookPayload;

      try {
        payloadData = JSON.parse(payload.toString()) as GitHubWebhookPayload;
      } catch (error) {
        log('error', `${WEBHOOK_LOG_PREFIX}Failed to parse webhook payload:`, error);

        return res.status(400).json({ error: 'Invalid JSON payload' });
      }

      const eventType = req.headers['x-github-event'] as string | undefined;
      const installationId = payloadData.installation?.id?.toString();

      log('info', `${WEBHOOK_LOG_PREFIX}Received webhook event: ${sgr(eventType || 'unknown', Effect.ForegroundCyan)}`);

      /**
       * Handle installation.deleted event
       */
      if (eventType === 'installation' && payloadData.action === 'deleted') {
        if (!installationId) {
          log('warn', 'installation.deleted event received but installation_id is missing');

          return res.status(200).json({ message: 'Event received but no installation_id provided' });
        }

        log('info', `Processing installation.deleted for installation_id: ${sgr(installationId, Effect.ForegroundCyan)}`);

        const workspacesCollection = databases.hawk?.collection('workspaces');
        const projectsCollection = databases.hawk?.collection('projects');

        if (!projectsCollection || !workspacesCollection) {
          log('error', 'MongoDB collections are not available');

          return res.status(500).json({ error: 'Database connection error' });
        }

        try {
          const installIdNum = parseInt(installationId, 10);

          /**
           * Remove installation from all workspaces that have it
           */
          const workspaceResult = await workspacesCollection.updateMany(
            {
              'integrations.github.installations.installationId': installIdNum,
            },
            {
              $pull: {
                'integrations.github.installations': { installationId: installIdNum },
              } as any,
            }
          );

          log('info', `Removed installation from ${sgr(workspaceResult.modifiedCount.toString(), Effect.ForegroundCyan)} workspace(s)`);

          /**
           * Remove taskManager configuration from all projects with this installationId
           */
          const projects = await projectsCollection
            .find({
              'taskManager.config.installationId': installationId,
            })
            .toArray();

          log('info', `Found ${sgr(projects.length.toString(), Effect.ForegroundCyan)} project(s) with installation_id ${installationId}`);

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
          log('error', `Failed to process installation.deleted: ${error instanceof Error ? error.message : String(error)}`);

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
   * GET /integration/github/repositories?workspaceId=<workspaceId>&installationId=<installationId>
   * Get list of repositories accessible to GitHub App installation(s) of the workspace.
   *
   * If workspace has a single installation, installationId is optional.
   * If workspace has multiple installations, installationId is required.
   */
  router.get('/repositories', async (req, res, next) => {
    try {
      const { workspaceId, installationId: installationIdParam } = req.query;

      /**
       * Validate workspace access and admin permissions
       */
      const access = await validateWorkspaceAdminAccess(req, res, workspaceId as string | undefined, 'access repository list');

      if (!access) {
        return;
      }

      const { workspace } = access;
      const installations = workspace.getGitHubInstallations();

      if (installations.length === 0) {
        res.status(400).json({ error: 'No GitHub installations found for this workspace' });

        return;
      }

      /**
       * Determine which installation to use
       */
      let installationId: string;

      if (installationIdParam && typeof installationIdParam === 'string') {
        const found = installations.find((i) => i.installationId.toString() === installationIdParam);

        if (!found) {
          res.status(404).json({ error: `Installation ${installationIdParam} not found in this workspace` });

          return;
        }
        installationId = installationIdParam;
      } else if (installations.length === 1) {
        installationId = installations[0].installationId.toString();
      } else {
        res.status(400).json({
          error: 'Multiple installations found. Please specify installationId.',
          installations: installations.map((i) => ({
            installationId: i.installationId,
            account: i.account,
          })),
        });

        return;
      }

      /**
       * Get list of repositories from GitHub
       */
      try {
        const repositories = await githubService.getRepositoriesForInstallation(installationId);

        const repoOwners = [ ...new Set(repositories.map((r) => r.fullName.split('/')[0])) ];

        log('info', `Retrieved ${repositories.length} repository(ies) for installation ${installationId}`);
        log('info', `Repository owners: ${repoOwners.join(', ')}`);

        res.json({
          repositories,
        });
      } catch (error) {
        log('error', `Failed to get repositories: ${error instanceof Error ? error.message : String(error)}`);

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
   * Bind a repository to a project.
   *
   * Body: { installationId, repoId, repoFullName, repoLanguage? }
   * Verifies that the installation belongs to the project's workspace.
   * Creates or updates taskManager config in the project.
   */
  router.put('/repository', async (req, res, next) => {
    try {
      const { projectId } = req.query;
      const { installationId, repoId, repoFullName, repoLanguage } = req.body;

      /**
       * Validate project access and admin permissions
       */
      const access = await validateProjectAdminAccess(req, res, projectId as string | undefined, 'update repository selection');

      if (!access) {
        return;
      }

      const { project, workspace } = access;
      const validatedProjectId = project._id.toString();

      /**
       * Validate request body
       */
      if (!installationId) {
        res.status(400).json({ error: 'installationId is required' });

        return;
      }

      if (!repoId || typeof repoId !== 'string') {
        res.status(400).json({ error: 'repoId is required and must be a string' });

        return;
      }

      if (!repoFullName || typeof repoFullName !== 'string') {
        res.status(400).json({ error: 'repoFullName is required and must be a string' });

        return;
      }

      /**
       * Verify that the installation belongs to this workspace
       */
      const installIdNum = typeof installationId === 'number'
        ? installationId
        : parseInt(String(installationId), 10);

      const installation = workspace.findGitHubInstallation(installIdNum);

      if (!installation) {
        res.status(400).json({ error: `Installation ${installationId} does not belong to this workspace` });

        return;
      }

      /**
       * Create or update taskManager config with repository binding.
       * installationId is stored as a copy from workspace for worker optimization.
       */
      const now = new Date();
      const taskManagerConfig = {
        type: 'github' as const,
        autoTaskEnabled: project.taskManager?.autoTaskEnabled ?? false,
        taskThresholdTotalCount: project.taskManager?.taskThresholdTotalCount ?? DEFAULT_TASK_THRESHOLD_TOTAL_COUNT,
        assignAgent: project.taskManager?.assignAgent ?? false,
        usage: project.taskManager?.usage,
        connectedAt: project.taskManager?.connectedAt ?? now,
        updatedAt: now,
        config: {
          installationId: String(installationId),
          repoId,
          repoFullName,
          ...(repoLanguage ? { repoLanguage } : {}),
        },
      };

      try {
        await project.updateProject({
          taskManager: taskManagerConfig,
        } as Partial<ProjectDBScheme>);

        log('info', validatedProjectId, `Bound repository ${repoFullName} (installation: ${installationId})`);

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
