import '../../src/env-test';
import { ObjectId } from 'mongodb';
import express from 'express';
import type { Request, Response } from 'express';
import { createGitHubRouter } from '../../src/integrations/github/routes';
import { ContextFactories } from '../../src/types/graphql';
import WorkspaceModel from '../../src/models/workspace';

/**
 * Mock GitHubService
 */
jest.mock('../../src/integrations/github/service', () => ({
  GitHubService: jest.fn().mockImplementation(() => ({
    getInstallationUrl: jest.fn((state: string) => {
      return `https://github.com/apps/test-app/installations/new?state=${encodeURIComponent(state)}&redirect_url=${encodeURIComponent('http://localhost:4000/integration/github/callback')}`;
    }),
  })),
}));

/**
 * Mock install state store
 */
jest.mock('../../src/integrations/github/store/install-state.redis.store', () => ({
  RedisInstallStateStore: jest.fn().mockImplementation(() => ({
    saveState: jest.fn().mockResolvedValue(undefined),
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
        resolve({ status: statusCode, body: data });
      },
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      end: jest.fn(),
      send: jest.fn((data?: any) => {
        if (!jsonCalled) {
          resolve({ status: statusCode, body: data });
        }
      }),
      redirect: jest.fn(),
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
          resolve({ status: statusCode, body: null });
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

    /**
     * Setup environment variables
     */
    process.env.GITHUB_APP_ID = '123456';
    process.env.API_URL = 'http://localhost:4000';
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'GITHUB_APP_ID');
    Reflect.deleteProperty(process.env, 'API_URL');
  });

  describe('GET /integration/github/connect', () => {
    it('should return JSON with redirectUrl when user is authenticated and is admin', async () => {
      const projectId = new ObjectId().toString();
      const workspaceId = new ObjectId().toString();
      const mockProject = createMockProject({ projectId, workspaceId });
      const mockWorkspace = createMockWorkspace({ workspaceId, isAdmin: true });

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
      const mockProject = createMockProject({ projectId, workspaceId });
      const mockWorkspace = createMockWorkspace({ workspaceId, isAdmin: false });

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
      const mockProject = createMockProject({ projectId, workspaceId });
      const mockWorkspace = createMockWorkspace({ workspaceId, member: null });

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
});
