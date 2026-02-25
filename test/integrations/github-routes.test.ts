import '../../src/env-test';
import { ObjectId } from 'mongodb';
import express from 'express';
import { createGitHubRouter } from '../../src/integrations/github/routes';
import { ContextFactories } from '../../src/types/graphql';

/**
 * All mock functions declared before jest.mock calls (Jest hoists mocks)
 */
/**
 * All mock functions declared before jest.mock calls (ts-jest requires this)
 */
const mockGetInstallationUrl = jest.fn((state: string) => {
  return `https://github.com/apps/test-app/installations/new?state=${encodeURIComponent(state)}&redirect_url=${encodeURIComponent('http://localhost:4000/integration/github/oauth')}`;
});
const mockGetInstallationForRepository = jest.fn();
const mockExchangeOAuthCodeForToken = jest.fn();
const mockGetState = jest.fn();

jest.mock('@hawk.so/github-sdk', () => ({
  GitHubService: jest.fn().mockImplementation(() => ({
    getInstallationUrl: mockGetInstallationUrl,
    getInstallationForRepository: mockGetInstallationForRepository,
    exchangeOAuthCodeForToken: mockExchangeOAuthCodeForToken,
  })),
}));

jest.mock('../../src/integrations/github/store/install-state.redis.store', () => ({
  RedisInstallStateStore: jest.fn().mockImplementation(() => ({
    saveState: jest.fn().mockResolvedValue(undefined),
    getState: mockGetState,
  })),
}));

jest.mock('../../src/mongo', () => ({
  databases: {
    hawk: {
      collection: jest.fn().mockReturnValue({
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      }),
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { databases: mockDatabases } = require('../../src/mongo');

function createMockWorkspace(options: {
  workspaceId?: string;
  isAdmin?: boolean;
  member?: any;
  installations?: any[];
}): any {
  const {
    workspaceId = new ObjectId().toString(),
    isAdmin = true,
    member,
    installations = [],
  } = options;

  const defaultMember = {
    userId: new ObjectId('507f1f77bcf86cd799439011'),
    isAdmin,
  };

  return {
    _id: new ObjectId(workspaceId),
    getMemberInfo: jest.fn().mockResolvedValue(member !== undefined ? member : defaultMember),
    getGitHubInstallations: jest.fn().mockReturnValue(installations),
    findGitHubInstallation: jest.fn().mockReturnValue(null),
    addGitHubInstallation: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockUser(userId: string): any {
  return {
    _id: new ObjectId(userId),
    upsertGitHubAuthorization: jest.fn().mockResolvedValue(undefined),
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
    mockDatabases.hawk.collection().updateOne.mockReset();
    mockDatabases.hawk.collection().updateOne.mockResolvedValue({ modifiedCount: 1 });

    /**
     * Setup environment variables
     */
    process.env.GITHUB_APP_ID = '123456';
    process.env.GITHUB_PRIVATE_KEY = 'test-private-key';
    process.env.API_URL = 'http://localhost:4000';
    process.env.GARAGE_URL = 'http://localhost:8080';
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'GITHUB_APP_ID');
    Reflect.deleteProperty(process.env, 'GITHUB_PRIVATE_KEY');
    Reflect.deleteProperty(process.env, 'API_URL');
  });

  describe('GET /integration/github/connect', () => {
    it('should return redirectUrl when no installations exist', async () => {
      const projectId = new ObjectId().toString();
      const workspaceId = new ObjectId().toString();
      const mockWorkspace = createMockWorkspace({
        workspaceId,
        isAdmin: true,
      });

      const factories: ContextFactories = {
        projectsFactory: {} as any,
        workspacesFactory: {
          findById: jest.fn().mockResolvedValue(mockWorkspace),
        } as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/connect', { projectId, workspaceId });

      expect(response.status).toBe(200);
      expect(response.body.hasInstallations).toBe(false);
      expect(response.body).toHaveProperty('redirectUrl');
      expect(response.body.redirectUrl).toContain('https://github.com/apps/test-app/installations/new');
      expect(response.body.redirectUrl).toMatch(/state=[^&]+/);
    });

    it('should return existing installations when workspace already has them', async () => {
      const projectId = new ObjectId().toString();
      const workspaceId = new ObjectId().toString();
      const existingInstallation = {
        installationId: 12345,
        account: { id: 1, login: 'test-org', type: 'Organization' },
      };
      const mockWorkspace = createMockWorkspace({
        workspaceId,
        isAdmin: true,
        installations: [existingInstallation],
      });

      const factories: ContextFactories = {
        projectsFactory: {} as any,
        workspacesFactory: {
          findById: jest.fn().mockResolvedValue(mockWorkspace),
        } as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/connect', { projectId, workspaceId });

      expect(response.status).toBe(200);
      expect(response.body.hasInstallations).toBe(true);
      expect(response.body.installations).toHaveLength(1);
      expect(response.body.installations[0].installationId).toBe(12345);
    });

    it('should return 401 when user is not authenticated', async () => {
      const projectId = new ObjectId().toString();
      const workspaceId = new ObjectId().toString();
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

      const response = await makeRequest(app, 'GET', '/integration/github/connect', { projectId, workspaceId });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Unauthorized');
    });

    it('should return 400 when projectId is missing', async () => {
      const workspaceId = new ObjectId().toString();
      const factories: ContextFactories = {
        projectsFactory: {} as any,
        workspacesFactory: {} as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/connect', { workspaceId });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('projectId');
    });

    it('should return 400 when projectId format is invalid', async () => {
      const workspaceId = new ObjectId().toString();
      const factories: ContextFactories = {
        projectsFactory: {} as any,
        workspacesFactory: {} as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/connect', { projectId: 'invalid-id', workspaceId });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('projectId');
    });

    it('should return 400 when workspaceId is missing', async () => {
      const projectId = new ObjectId().toString();
      const factories: ContextFactories = {
        projectsFactory: {} as any,
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
      expect(response.body.error).toContain('workspaceId');
    });

    it('should return 400 when workspaceId format is invalid', async () => {
      const projectId = new ObjectId().toString();
      const factories: ContextFactories = {
        projectsFactory: {} as any,
        workspacesFactory: {} as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/connect', {
        projectId,
        workspaceId: 'invalid-workspace-id',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid workspaceId format');
    });

    it('should return 404 when workspace is not found', async () => {
      const projectId = new ObjectId().toString();
      const workspaceId = new ObjectId().toString();
      const factories: ContextFactories = {
        projectsFactory: {} as any,
        workspacesFactory: {
          findById: jest.fn().mockResolvedValue(null),
        } as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/connect', {
        projectId,
        workspaceId
      });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Workspace not found');
    });

    it('should return 403 when user is not admin', async () => {
      const projectId = new ObjectId().toString();
      const workspaceId = new ObjectId().toString();
      const mockWorkspace = createMockWorkspace({
        workspaceId,
        isAdmin: false,
      });

      const factories: ContextFactories = {
        projectsFactory: {} as any,
        workspacesFactory: {
          findById: jest.fn().mockResolvedValue(mockWorkspace),
        } as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/connect', {
        projectId,
        workspaceId
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Not enough permissions');
    });

    it('should return 403 when user is not a member of workspace', async () => {
      const projectId = new ObjectId().toString();
      const workspaceId = new ObjectId().toString();
      const mockWorkspace = createMockWorkspace({
        workspaceId,
        member: null,
      });

      const factories: ContextFactories = {
        projectsFactory: {} as any,
        workspacesFactory: {
          findById: jest.fn().mockResolvedValue(mockWorkspace),
        } as any,
        usersFactory: {} as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/connect', { projectId, workspaceId });

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

    function createDefaultStateData(): any {
      return {
        workspaceId,
        projectId,
        userId,
        timestamp: Date.now(),
      };
    }

    function createOAuthFactories(options: {
      workspace?: any;
      user?: any;
    } = {}): ContextFactories {
      const mockWorkspace = options.workspace || createMockWorkspace({ workspaceId });
      const mockUser = options.user || createMockUser(userId);

      return {
        projectsFactory: {} as any,
        workspacesFactory: {
          findById: jest.fn().mockResolvedValue(mockWorkspace),
        } as any,
        usersFactory: {
          findById: jest.fn().mockResolvedValue(mockUser),
        } as any,
        plansFactory: {} as any,
        businessOperationsFactory: {} as any,
        releasesFactory: {} as any,
      };
    }

    it('should redirect with error when code is missing', async () => {
      setupRouter(createOAuthFactories());

      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        state,
      });

      expect(response.status).toBe(302);
      expect(response.body).toContain('http://localhost:8080/');
      expect(response.body).toContain('apiError=Missing+or+invalid+OAuth+code');
    });

    it('should redirect with error when state is missing', async () => {
      setupRouter(createOAuthFactories());

      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        code,
      });

      expect(response.status).toBe(302);
      expect(response.body).toContain('http://localhost:8080/');
      expect(response.body).toContain('apiError=Missing+or+invalid+state');
    });

    it('should redirect with error when state is invalid or expired', async () => {
      mockGetState.mockResolvedValue(null);

      setupRouter(createOAuthFactories());

      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        code,
        state,
      });

      expect(response.status).toBe(302);
      expect(response.body).toContain('http://localhost:8080/');
      expect(response.body).toContain('apiError=Invalid+or+expired+state');
      expect(mockGetState).toHaveBeenCalledWith(state);
    });

    it('should redirect with error when workspace is not found', async () => {
      mockGetState.mockResolvedValue(createDefaultStateData());

      const factories: ContextFactories = {
        projectsFactory: {} as any,
        workspacesFactory: {
          findById: jest.fn().mockResolvedValue(null),
        } as any,
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
      expect(response.body).toContain('apiError=Workspace+not+found');
    });

    it('should redirect with error when getInstallationForRepository fails', async () => {
      mockGetState.mockResolvedValue(createDefaultStateData());
      mockGetInstallationForRepository.mockRejectedValue(new Error('Installation not found'));

      setupRouter(createOAuthFactories());

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

    it('should redirect with error when saving installation to workspace fails', async () => {
      mockGetState.mockResolvedValue(createDefaultStateData());
      mockGetInstallationForRepository.mockResolvedValue({
        account: { id: 1, login: 'test-org' },
        target_type: 'Organization',
      });

      const mockWorkspace = createMockWorkspace({ workspaceId });
      mockWorkspace.addGitHubInstallation.mockRejectedValue(new Error('Database error'));

      setupRouter(createOAuthFactories({ workspace: mockWorkspace }));

      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        code,
        state,
        // eslint-disable-next-line @typescript-eslint/camelcase, camelcase
        installation_id: installationId,
      });

      expect(response.status).toBe(302);
      expect(response.body).toContain(`/project/${projectId}/settings/task-manager`);
      expect(response.body).toContain('error=Failed+to+save+installation');
    });

    it('should redirect with error when exchangeOAuthCodeForToken fails', async () => {
      mockGetState.mockResolvedValue(createDefaultStateData());
      mockExchangeOAuthCodeForToken.mockRejectedValue(new Error('Invalid code'));

      setupRouter(createOAuthFactories());

      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        code,
        state,
      });

      expect(response.status).toBe(302);
      expect(response.body).toContain(`/project/${projectId}/settings/task-manager`);
      expect(response.body).toContain('error=Failed+to+exchange+OAuth+code+for+token');
      expect(mockExchangeOAuthCodeForToken).toHaveBeenCalledWith(code);
    });

    it('should redirect with error when user is not found during token save', async () => {
      mockGetState.mockResolvedValue(createDefaultStateData());
      mockExchangeOAuthCodeForToken.mockResolvedValue({
        user: { id: 'github-user-123', login: 'testuser' },
        accessToken: 'token-123',
        refreshToken: 'refresh-123',
        refreshTokenExpiresAt: new Date(),
      });

      const factories = createOAuthFactories();
      (factories.usersFactory as any).findById = jest.fn().mockResolvedValue(null);

      setupRouter(factories);

      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        code,
        state,
      });

      expect(response.status).toBe(302);
      expect(response.body).toContain(`/project/${projectId}/settings/task-manager`);
      expect(response.body).toContain('error=User+not+found');
    });

    it('should redirect with error when saving authorization fails', async () => {
      mockGetState.mockResolvedValue(createDefaultStateData());
      mockExchangeOAuthCodeForToken.mockResolvedValue({
        user: { id: 'github-user-123', login: 'testuser' },
        accessToken: 'token-123',
        refreshToken: 'refresh-123',
        refreshTokenExpiresAt: new Date(),
      });

      const mockUser = createMockUser(userId);
      mockUser.upsertGitHubAuthorization.mockRejectedValue(new Error('DB error'));

      setupRouter(createOAuthFactories({ user: mockUser }));

      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        code,
        state,
      });

      expect(response.status).toBe(302);
      expect(response.body).toContain(`/project/${projectId}/settings/task-manager`);
      expect(response.body).toContain('error=Failed+to+save+OAuth+token');
    });

    it('should successfully complete OAuth flow without installation_id', async () => {
      mockGetState.mockResolvedValue(createDefaultStateData());
      mockExchangeOAuthCodeForToken.mockResolvedValue({
        user: { id: 'github-user-123', login: 'testuser' },
        accessToken: 'token-123',
        expiresAt: new Date('2025-12-31'),
        refreshToken: 'refresh-123',
        refreshTokenExpiresAt: new Date('2026-12-31'),
      });

      const mockUser = createMockUser(userId);

      setupRouter(createOAuthFactories({ user: mockUser }));

      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        code,
        state,
      });

      expect(response.status).toBe(302);
      expect(response.body).toContain(`/project/${projectId}/settings/task-manager`);
      expect(response.body).toContain('success=true');
      expect(mockExchangeOAuthCodeForToken).toHaveBeenCalledWith(code);
      expect(mockUser.upsertGitHubAuthorization).toHaveBeenCalledWith(
        expect.objectContaining({
          githubUserId: 'github-user-123',
          githubLogin: 'testuser',
          refreshToken: 'refresh-123',
          status: 'active',
        })
      );
    });

    it('should successfully complete OAuth flow with installation_id', async () => {
      mockGetState.mockResolvedValue(createDefaultStateData());
      mockGetInstallationForRepository.mockResolvedValue({
        account: { id: 1, login: 'test-org' },
        target_type: 'Organization',
      });
      mockExchangeOAuthCodeForToken.mockResolvedValue({
        user: { id: 'github-user-123', login: 'testuser' },
        accessToken: 'token-123',
        expiresAt: new Date('2025-12-31'),
        refreshToken: 'refresh-123',
        refreshTokenExpiresAt: new Date('2026-12-31'),
      });

      const mockWorkspace = createMockWorkspace({ workspaceId });
      const mockUser = createMockUser(userId);

      setupRouter(createOAuthFactories({ workspace: mockWorkspace, user: mockUser }));

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
      expect(mockWorkspace.addGitHubInstallation).toHaveBeenCalledWith(
        expect.objectContaining({
          installationId: parseInt(installationId, 10),
          account: expect.objectContaining({
            id: 1,
            login: 'test-org',
            type: 'Organization',
          }),
          delegatedUser: null,
        })
      );

      expect(mockExchangeOAuthCodeForToken).toHaveBeenCalledWith(code);
      expect(mockUser.upsertGitHubAuthorization).toHaveBeenCalled();

      expect(mockDatabases.hawk.collection().updateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          'integrations.github.installations.installationId': parseInt(installationId, 10),
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            'integrations.github.installations.$.delegatedUser': expect.objectContaining({
              hawkUserId: userId,
              githubUserId: 'github-user-123',
              githubLogin: 'testuser',
              status: 'active',
            }),
          }),
        })
      );
    });

    it('should skip saving installation when it already exists in workspace', async () => {
      mockGetState.mockResolvedValue(createDefaultStateData());
      mockExchangeOAuthCodeForToken.mockResolvedValue({
        user: { id: 'github-user-123', login: 'testuser' },
        accessToken: 'token-123',
        refreshToken: 'refresh-123',
        refreshTokenExpiresAt: new Date('2026-12-31'),
      });

      const mockWorkspace = createMockWorkspace({ workspaceId });
      mockWorkspace.findGitHubInstallation.mockReturnValue({
        installationId: parseInt(installationId, 10),
        account: { id: 1, login: 'test-org', type: 'Organization' },
      });

      const mockUser = createMockUser(userId);

      setupRouter(createOAuthFactories({ workspace: mockWorkspace, user: mockUser }));

      const response = await makeRequest(app, 'GET', '/integration/github/oauth', {
        code,
        state,
        // eslint-disable-next-line @typescript-eslint/camelcase, camelcase
        installation_id: installationId,
      });

      expect(response.status).toBe(302);
      expect(response.body).toContain('success=true');
      expect(mockWorkspace.addGitHubInstallation).not.toHaveBeenCalled();
      expect(mockGetInstallationForRepository).not.toHaveBeenCalled();
    });
  });
});
