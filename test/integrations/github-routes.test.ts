import '../../src/env-test';
import { ObjectId } from 'mongodb';
import express from 'express';
import { createGitHubRouter } from '../../src/integrations/github/routes';
import { ContextFactories } from '../../src/types/graphql';

/**
 * Mock GitHubService
 */
const mockGetInstallationUrl = jest.fn((state: string) => {
  return `https://github.com/apps/test-app/installations/new?state=${encodeURIComponent(state)}&redirect_url=${encodeURIComponent('http://localhost:4000/integration/github/oauth')}`;
});
const mockGetInstallationForRepository = jest.fn();
const mockExchangeOAuthCodeForToken = jest.fn();

jest.mock('../../src/integrations/github/service', () => ({
  GitHubService: jest.fn().mockImplementation(() => ({
    getInstallationUrl: mockGetInstallationUrl,
    getInstallationForRepository: mockGetInstallationForRepository,
    exchangeOAuthCodeForToken: mockExchangeOAuthCodeForToken,
  })),
}));

/**
 * Mock install state store
 */
const mockGetState = jest.fn();
jest.mock('../../src/integrations/github/store/install-state.redis.store', () => ({
  RedisInstallStateStore: jest.fn().mockImplementation(() => ({
    saveState: jest.fn().mockResolvedValue(undefined),
    getState: mockGetState,
  })),
}));

const DEMO_WORKSPACE_ID = '6213b6a01e6281087467cc7a';

function createMockProject(options: {
  projectId?: string;
  workspaceId?: string;
}): any {
  const {
    projectId = new ObjectId().toString(),
    workspaceId = new ObjectId().toString(),
  } = options;

  return {
    _id: new ObjectId(projectId),
    workspaceId: new ObjectId(workspaceId),
    name: 'Test Project',
  };
}

function createMockWorkspace(options: {
  workspaceId?: string;
  isAdmin?: boolean;
  member?: any;
}): any {
  const {
    workspaceId = new ObjectId().toString(),
    isAdmin = true,
    member,
  } = options;

  const defaultMember = {
    userId: new ObjectId('507f1f77bcf86cd799439011'),
    isAdmin,
  };

  return {
    _id: new ObjectId(workspaceId),
    getMemberInfo: jest.fn().mockResolvedValue(member !== undefined ? member : defaultMember),
  };
}

/**
 * Helper function to make a request to Express app
 */
function makeRequest(
  app: express.Application,
  method: string,
  path: string,
  query?: Record<string, string>
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = query ? `${path}?${new URLSearchParams(query).toString()}` : path;
    const req = {
      method,
      url,
      originalUrl: url,
      path,
      query: query || {},
      headers: {},
      get: jest.fn(),
      params: {},
      body: {},
    } as any;

    let statusCode = 200;
    let jsonCalled = false;
    const res = {
      status: (code: number) => {
        statusCode = code;

        return res;
      },
      json: (data: any) => {
        jsonCalled = true;
        resolve({
          status: statusCode,
          body: data,
        });
      },
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      end: jest.fn(),
      send: jest.fn((data?: any) => {
        if (!jsonCalled) {
          resolve({
            status: statusCode,
            body: data,
          });
        }
      }),
      redirect: jest.fn((redirectUrl: string) => {
        statusCode = 302;
        resolve({
          status: statusCode,
          body: redirectUrl,
        });
      }),
    } as any;

    /**
     * Use (app as any).handle() as handle method exists but is not in TypeScript types
     * This simulates how Express processes requests internally
     */
    (app as any).handle(req, res, (err: any) => {
      if (err) {
        reject(err);
      } else if (!jsonCalled) {
        /**
         * If json was not called, check if response was sent another way
         * Wait a bit to allow async handlers to complete
         */
        setTimeout(() => {
          resolve({
            status: statusCode,
            body: null,
          });
        }, 50);
      }
    });
  });
}

describe('GitHub Routes - /integration/github/connect', () => {
  let app: express.Application;
  const userId = '507f1f77bcf86cd799439011';

  /**
   * Setup router with factories for testing
   */
  function setupRouter(factories: ContextFactories, contextOverrides?: (req: any) => void): void {
    /**
     * Create new Express app for each test
     */
    app = express();

    /**
     * Add middleware to set context (simulating req.context from index.ts)
     */
    app.use((req, res, next) => {
      req.context = {
        user: {
          id: userId,
          accessTokenExpired: false,
        },
        factories,
      };

      /**
       * Apply context overrides if provided
       */
      if (contextOverrides) {
        contextOverrides(req);
      }

      next();
    });

    /**
     * Create router with factories and mount it
     */
    const router = createGitHubRouter(factories);
    app.use('/integration/github', router);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetState.mockReset();
    mockGetInstallationForRepository.mockReset();
    mockExchangeOAuthCodeForToken.mockReset();

    /**
     * Setup environment variables
     */
    process.env.GITHUB_APP_ID = '123456';
    process.env.API_URL = 'http://localhost:4000';
    process.env.GARAGE_URL = 'http://localhost:8080';
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'GITHUB_APP_ID');
    Reflect.deleteProperty(process.env, 'API_URL');
  });

  describe('GET /integration/github/connect', () => {
    it('should return JSON with redirectUrl when user is authenticated and is admin', async () => {
      const projectId = new ObjectId().toString();
      const workspaceId = new ObjectId().toString();
      const mockProject = createMockProject({
        projectId,
        workspaceId,
      });
      const mockWorkspace = createMockWorkspace({
        workspaceId,
        isAdmin: true,
      });

      const factories: ContextFactories = {
        projectsFactory: {
          findById: jest.fn().mockResolvedValue(mockProject),
        } as any,
        workspacesFactory: {
          findById: jest.fn().mockResolvedValue(mockWorkspace),
        } as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/connect', { projectId });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('redirectUrl');
      expect(response.body.redirectUrl).toContain('https://github.com/apps/test-app/installations/new');
      expect(response.body.redirectUrl).toMatch(/state=[^&]+/);
    });

    it('should return 401 when user is not authenticated', async () => {
      const projectId = new ObjectId().toString();
      const factories: ContextFactories = {
        projectsFactory: {} as any,
        workspacesFactory: {} as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories, (req) => {
        req.context.user.id = undefined;
      });

      const response = await makeRequest(app, 'GET', '/integration/github/connect', { projectId });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Unauthorized');
    });

    it('should return 400 when projectId is missing', async () => {
      const factories: ContextFactories = {
        projectsFactory: {} as any,
        workspacesFactory: {} as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/connect');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('projectId');
    });

    it('should return 400 when projectId format is invalid', async () => {
      const factories: ContextFactories = {
        projectsFactory: {} as any,
        workspacesFactory: {} as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/connect', { projectId: 'invalid-id' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid projectId format');
    });

    it('should return 404 when project is not found', async () => {
      const projectId = new ObjectId().toString();
      const factories: ContextFactories = {
        projectsFactory: {
          findById: jest.fn().mockResolvedValue(null),
        } as any,
        workspacesFactory: {} as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/connect', { projectId });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Project not found');
    });

    it('should return 400 when project is demo project', async () => {
      const projectId = new ObjectId().toString();
      const mockProject = createMockProject({
        projectId,
        workspaceId: DEMO_WORKSPACE_ID,
      });
      const factories: ContextFactories = {
        projectsFactory: {
          findById: jest.fn().mockResolvedValue(mockProject),
        } as any,
        workspacesFactory: {} as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/connect', { projectId });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Unable to update demo project');
    });

    it('should return 403 when user is not admin', async () => {
      const projectId = new ObjectId().toString();
      const workspaceId = new ObjectId().toString();
      const mockProject = createMockProject({
        projectId,
        workspaceId,
      });
      const mockWorkspace = createMockWorkspace({
        workspaceId,
        isAdmin: false,
      });

      const factories: ContextFactories = {
        projectsFactory: {
          findById: jest.fn().mockResolvedValue(mockProject),
        } as any,
        workspacesFactory: {
          findById: jest.fn().mockResolvedValue(mockWorkspace),
        } as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/connect', { projectId });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Not enough permissions');
    });

    it('should return 403 when user is not a member of workspace', async () => {
      const projectId = new ObjectId().toString();
      const workspaceId = new ObjectId().toString();
      const mockProject = createMockProject({
        projectId,
        workspaceId,
      });
      const mockWorkspace = createMockWorkspace({
        workspaceId,
        member: null,
      });

      const factories: ContextFactories = {
        projectsFactory: {
          findById: jest.fn().mockResolvedValue(mockProject),
        } as any,
        workspacesFactory: {
          findById: jest.fn().mockResolvedValue(mockWorkspace),
        } as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/connect', { projectId });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not a member');
    });
  });

  describe('GET /integration/github/oauth', () => {
    const projectId = new ObjectId().toString();
    const workspaceId = new ObjectId().toString();
    const state = 'test-state-123';
    const code = 'test-oauth-code';
    const installationId = '12345678';

    /**
     * Helper to create mock project with taskManager
     */
    function createMockProjectWithTaskManager(taskManager?: any): any {
      const mockProject = createMockProject({
        projectId,
        workspaceId,
      });

      return {
        ...mockProject,
        taskManager: taskManager || {
          type: 'github',
          autoTaskEnabled: false,
          taskThresholdTotalCount: 50,
          assignAgent: false,
          connectedAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          config: {
            installationId: installationId,
            repoId: '789012',
            repoFullName: 'owner/repo',
          },
        },
        updateProject: jest.fn().mockResolvedValue(undefined),
      };
    }

    it('should redirect with error when code is missing', async () => {
      const factories: ContextFactories = {
        projectsFactory: {} as any,
        workspacesFactory: {} as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        state,
      });

      expect(response.status).toBe(302);
      expect(response.body).toContain('http://localhost:8080/');
      expect(response.body).toContain('error=Missing+or+invalid+OAuth+code');
    });

    it('should redirect with error when state is missing', async () => {
      const factories: ContextFactories = {
        projectsFactory: {} as any,
        workspacesFactory: {} as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        code,
      });

      expect(response.status).toBe(302);
      expect(response.body).toContain('http://localhost:8080/');
      expect(response.body).toContain('error=Missing+or+invalid+state');
    });

    it('should redirect with error when state is invalid or expired', async () => {
      mockGetState.mockResolvedValue(null);

      const factories: ContextFactories = {
        projectsFactory: {} as any,
        workspacesFactory: {} as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        code,
        state,
      });

      expect(response.status).toBe(302);
      expect(response.body).toContain('http://localhost:8080/');
      expect(response.body).toContain('error=Invalid+or+expired+state');
      expect(mockGetState).toHaveBeenCalledWith(state);
    });

    it('should redirect with error when project is not found', async () => {
      mockGetState.mockResolvedValue({
        projectId,
        userId,
        timestamp: Date.now(),
      });

      const factories: ContextFactories = {
        projectsFactory: {
          findById: jest.fn().mockResolvedValue(null),
        } as any,
        workspacesFactory: {} as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        code,
        state,
      });

      expect(response.status).toBe(302);
      expect(response.body).toContain(`/project/${projectId}/settings/task-manager`);
      expect(response.body).toContain('error=Project+not+found');
    });

    it('should redirect with error when installation_id is present but getInstallationForRepository fails', async () => {
      mockGetState.mockResolvedValue({
        projectId,
        userId,
        timestamp: Date.now(),
      });

      const mockProject = createMockProjectWithTaskManager();
      mockGetInstallationForRepository.mockRejectedValue(new Error('Installation not found'));

      const factories: ContextFactories = {
        projectsFactory: {
          findById: jest.fn().mockResolvedValue(mockProject),
        } as any,
        workspacesFactory: {} as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        code,
        state,
        // eslint-disable-next-line @typescript-eslint/camelcase, camelcase
        installation_id: installationId,
      });

      expect(response.status).toBe(302);
      expect(response.body).toContain(`/project/${projectId}/settings/task-manager`);
      expect(response.body).toContain('error=Failed+to+retrieve+GitHub+installation+information');
      expect(mockGetInstallationForRepository).toHaveBeenCalledWith(installationId);
    });

    it('should redirect with error when saving taskManager config fails', async () => {
      mockGetState.mockResolvedValue({
        projectId,
        userId,
        timestamp: Date.now(),
      });

      const mockProject = createMockProjectWithTaskManager();
      mockProject.updateProject.mockRejectedValue(new Error('Database error'));
      mockGetInstallationForRepository.mockResolvedValue({});

      const factories: ContextFactories = {
        projectsFactory: {
          findById: jest.fn().mockResolvedValue(mockProject),
        } as any,
        workspacesFactory: {} as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        code,
        state,
        // eslint-disable-next-line @typescript-eslint/camelcase, camelcase
        installation_id: installationId,
      });

      expect(response.status).toBe(302);
      expect(response.body).toContain(`/project/${projectId}/settings/task-manager`);
      expect(response.body).toContain('error=Failed+to+save+Task+Manager+configuration');
    });

    it('should redirect with error when project is not found after update', async () => {
      mockGetState.mockResolvedValue({
        projectId,
        userId,
        timestamp: Date.now(),
      });

      const mockProject = createMockProjectWithTaskManager();
      mockGetInstallationForRepository.mockResolvedValue({});
      mockProject.updateProject.mockResolvedValue(undefined);

      const factories: ContextFactories = {
        projectsFactory: {
          findById: jest.fn()
            .mockResolvedValueOnce(mockProject) // First call - project exists
            .mockResolvedValueOnce(null), // Second call after update - project not found
        } as any,
        workspacesFactory: {} as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        code,
        state,
        // eslint-disable-next-line @typescript-eslint/camelcase, camelcase
        installation_id: installationId,
      });

      expect(response.status).toBe(302);
      expect(response.body).toContain(`/project/${projectId}/settings/task-manager`);
      expect(response.body).toContain('error=Project+not+found');
    });

    it('should redirect with error when project does not have taskManager after installation', async () => {
      mockGetState.mockResolvedValue({
        projectId,
        userId,
        timestamp: Date.now(),
      });

      const mockProject = createMockProject({
        projectId,
        workspaceId,
      });
      mockProject.taskManager = null;
      mockProject.updateProject = jest.fn().mockResolvedValue(undefined);
      mockGetInstallationForRepository.mockResolvedValue({});

      const factories: ContextFactories = {
        projectsFactory: {
          findById: jest.fn().mockResolvedValue(mockProject),
        } as any,
        workspacesFactory: {} as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        code,
        state,
        // eslint-disable-next-line @typescript-eslint/camelcase, camelcase
        installation_id: installationId,
      });

      expect(response.status).toBe(302);
      expect(response.body).toContain(`/project/${projectId}/settings/task-manager`);
      expect(response.body).toContain('error=GitHub+App+installation+failed');
    });

    it('should redirect with error when exchangeOAuthCodeForToken fails', async () => {
      mockGetState.mockResolvedValue({
        projectId,
        userId,
        timestamp: Date.now(),
      });

      const mockProject = createMockProjectWithTaskManager();
      mockExchangeOAuthCodeForToken.mockRejectedValue(new Error('Invalid code'));

      const factories: ContextFactories = {
        projectsFactory: {
          findById: jest.fn().mockResolvedValue(mockProject),
        } as any,
        workspacesFactory: {} as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        code,
        state,
      });

      expect(response.status).toBe(302);
      expect(response.body).toContain(`/project/${projectId}/settings/task-manager`);
      expect(response.body).toContain('error=Failed+to+exchange+OAuth+code+for+token');
      expect(mockExchangeOAuthCodeForToken).toHaveBeenCalledWith(code);
    });

    it('should redirect with error when saving delegatedUser fails', async () => {
      mockGetState.mockResolvedValue({
        projectId,
        userId,
        timestamp: Date.now(),
      });

      const mockProject = createMockProjectWithTaskManager();
      mockProject.updateProject.mockRejectedValueOnce(new Error('Database error'));
      mockExchangeOAuthCodeForToken.mockResolvedValue({
        user: {
          id: 'github-user-123',
          login: 'testuser',
        },
        accessToken: 'token-123',
        expiresAt: new Date(),
        refreshToken: 'refresh-123',
        refreshTokenExpiresAt: new Date(),
      });

      const factories: ContextFactories = {
        projectsFactory: {
          findById: jest.fn().mockResolvedValue(mockProject),
        } as any,
        workspacesFactory: {} as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        code,
        state,
      });

      expect(response.status).toBe(302);
      expect(response.body).toContain(`/project/${projectId}/settings/task-manager`);
      expect(response.body).toContain('error=Failed+to+save+OAuth+token');
    });

    /**
     * Scenario: GitHub App is already installed, user authorizes via OAuth to get access token
     * This happens when:
     * 1. GitHub App was installed earlier (taskManager config already exists with installationId)
     * 2. User clicks "Connect" again or needs to re-authorize
     * 3. GitHub redirects back with OAuth code (but no installation_id, since installation already exists)
     * Expected: OAuth code is exchanged for token, delegatedUser is saved to existing taskManager config
     */
    it('should save OAuth token when GitHub App is already installed (no installation_id in callback)', async () => {
      mockGetState.mockResolvedValue({
        projectId,
        userId,
        timestamp: Date.now(),
      });

      /**
       * Project already has taskManager config with installationId from previous installation
       */
      const mockProject = createMockProjectWithTaskManager();
      mockProject.updateProject.mockResolvedValue(undefined);

      /**
       * Mock successful OAuth token exchange
       */
      mockExchangeOAuthCodeForToken.mockResolvedValue({
        user: {
          id: 'github-user-123',
          login: 'testuser',
        },
        accessToken: 'token-123',
        expiresAt: new Date('2025-12-31'),
        refreshToken: 'refresh-123',
        refreshTokenExpiresAt: new Date('2026-12-31'),
      });

      const factories: ContextFactories = {
        projectsFactory: {
          findById: jest.fn().mockResolvedValue(mockProject),
        } as any,
        workspacesFactory: {} as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      /**
       * OAuth callback without installation_id (installation already exists)
       */
      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        code,
        state,
      });

      /**
       * Should redirect to settings page with success
       */
      expect(response.status).toBe(302);
      expect(response.body).toContain(`/project/${projectId}/settings/task-manager`);
      expect(response.body).toContain('success=true');

      /**
       * Should exchange OAuth code for token
       */
      expect(mockExchangeOAuthCodeForToken).toHaveBeenCalledWith(code);

      /**
       * Should save delegatedUser to existing taskManager config
       */
      expect(mockProject.updateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          taskManager: expect.objectContaining({
            config: expect.objectContaining({
              delegatedUser: expect.objectContaining({
                hawkUserId: userId,
                githubUserId: 'github-user-123',
                githubLogin: 'testuser',
                accessToken: 'token-123',
              }),
            }),
          }),
        })
      );
    });

    it('should successfully complete OAuth flow with installation_id', async () => {
      mockGetState.mockResolvedValue({
        projectId,
        userId,
        timestamp: Date.now(),
      });

      const mockProject = createMockProject({
        projectId,
        workspaceId,
      });
      mockProject.taskManager = null;
      mockProject.updateProject = jest.fn().mockResolvedValue(undefined);

      mockGetInstallationForRepository.mockResolvedValue({});
      mockExchangeOAuthCodeForToken.mockResolvedValue({
        user: {
          id: 'github-user-123',
          login: 'testuser',
        },
        accessToken: 'token-123',
        expiresAt: new Date('2025-12-31'),
        refreshToken: 'refresh-123',
        refreshTokenExpiresAt: new Date('2026-12-31'),
      });

      const factories: ContextFactories = {
        projectsFactory: {
          findById: jest.fn()
            .mockResolvedValueOnce(mockProject) // First call - before installation
            .mockResolvedValueOnce({ // Second call - after installation update
              ...mockProject,
              taskManager: {
                type: 'github',
                autoTaskEnabled: false,
                taskThresholdTotalCount: 50,
                assignAgent: false,
                connectedAt: expect.any(Date),
                updatedAt: expect.any(Date),
                config: {
                  installationId: installationId,
                  repoId: '',
                  repoFullName: '',
                },
              },
            }),
        } as any,
        workspacesFactory: {} as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        code,
        state,
        // eslint-disable-next-line @typescript-eslint/camelcase, camelcase
        installation_id: installationId,
      });

      expect(response.status).toBe(302);
      expect(response.body).toContain(`/project/${projectId}/settings/task-manager`);
      expect(response.body).toContain('success=true');
      expect(mockGetInstallationForRepository).toHaveBeenCalledWith(installationId);
      expect(mockExchangeOAuthCodeForToken).toHaveBeenCalledWith(code);
      expect(mockProject.updateProject).toHaveBeenCalledTimes(2); // Once for installation, once for delegatedUser
    });

    it('should preserve existing taskManager config when updating with installation_id', async () => {
      mockGetState.mockResolvedValue({
        projectId,
        userId,
        timestamp: Date.now(),
      });

      const existingConfig = {
        installationId: 'old-installation-id',
        repoId: 'existing-repo-id',
        repoFullName: 'existing/owner-repo',
        delegatedUser: {
          hawkUserId: userId,
          githubUserId: 'old-github-user',
          githubLogin: 'olduser',
          accessToken: 'old-token',
        },
      };

      const mockProject = createMockProjectWithTaskManager({
        type: 'github',
        autoTaskEnabled: true,
        taskThresholdTotalCount: 100,
        assignAgent: true,
        connectedAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        config: existingConfig,
      });
      mockProject.updateProject = jest.fn().mockResolvedValue(undefined);

      mockGetInstallationForRepository.mockResolvedValue({});
      mockExchangeOAuthCodeForToken.mockResolvedValue({
        user: {
          id: 'github-user-123',
          login: 'testuser',
        },
        accessToken: 'token-123',
        expiresAt: new Date('2025-12-31'),
        refreshToken: 'refresh-123',
        refreshTokenExpiresAt: new Date('2026-12-31'),
      });

      const factories: ContextFactories = {
        projectsFactory: {
          findById: jest.fn().mockResolvedValue(mockProject),
        } as any,
        workspacesFactory: {} as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        code,
        state,
        // eslint-disable-next-line @typescript-eslint/camelcase, camelcase
        installation_id: installationId,
      });

      expect(response.status).toBe(302);
      expect(response.body).toContain('success=true');

      /**
       * Check that first update (installation) preserves existing config
       */
      const firstUpdateCall = mockProject.updateProject.mock.calls[0];
      expect(firstUpdateCall[0].taskManager.config.installationId).toBe(installationId);
      expect(firstUpdateCall[0].taskManager.config.repoId).toBe('existing-repo-id');
      expect(firstUpdateCall[0].taskManager.config.repoFullName).toBe('existing/owner-repo');
      expect(firstUpdateCall[0].taskManager.config.delegatedUser).toEqual(existingConfig.delegatedUser);
    });
  });
});
