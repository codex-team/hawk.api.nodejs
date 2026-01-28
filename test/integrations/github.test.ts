import '../../src/env-test';
import { GitHubService } from '../../src/integrations/github/service';
import jwt from 'jsonwebtoken';

/**
 * Mock @octokit/rest as virtual mock since module might not be installed in test environment
 * Using virtual: true allows Jest to create a mock without requiring the module to exist
 */
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn(),
}), { virtual: true });

/**
 * Mock jsonwebtoken
 */
jest.mock('jsonwebtoken');

describe('GitHubService', () => {
  let githubService: GitHubService;
  const testAppId = '123456';
  const testAppSlug = 'hawk-tracker';
  const testPrivateKey = '-----BEGIN RSA PRIVATE KEY-----\nTEST_KEY\n-----END RSA PRIVATE KEY-----';
  const testClientId = 'Iv1.client-id';
  const testClientSecret = 'client-secret';
  const testInstallationId = '789012';
  const testApiUrl = 'https://api.example.com';

  let mockOctokit: {
    rest: {
      apps: {
        createInstallationAccessToken: jest.Mock;
        getInstallation: jest.Mock;
      };
      issues: {
        create: jest.Mock;
        addAssignees: jest.Mock;
      };
    };
    graphql: jest.Mock;
  };

  const createMockOctokit = (): typeof mockOctokit => {
    const createTokenMock = jest.fn();
    const getInstallationMock = jest.fn();
    const createIssueMock = jest.fn();
    const addAssigneesMock = jest.fn();
    const graphqlMock = jest.fn();

    return {
      rest: {
        apps: {
          createInstallationAccessToken: createTokenMock,
          getInstallation: getInstallationMock,
        },
        issues: {
          create: createIssueMock,
          addAssignees: addAssigneesMock,
        },
      },
      graphql: graphqlMock,
    };
  };

  beforeEach(() => {
    /**
     * Clear all mocks
     */
    jest.clearAllMocks();

    /**
     * Setup environment variables
     */
    process.env.GITHUB_APP_ID = testAppId;
    process.env.GITHUB_APP_SLUG = testAppSlug;
    process.env.GITHUB_PRIVATE_KEY = testPrivateKey;
    process.env.GITHUB_APP_CLIENT_ID = testClientId;
    process.env.GITHUB_APP_CLIENT_SECRET = testClientSecret;
    process.env.API_URL = testApiUrl;

    /**
     * Mock Octokit instance
     */
    mockOctokit = createMockOctokit();

    /**
     * Get mocked Octokit constructor and set implementation
     */
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Octokit } = require('@octokit/rest');

    Octokit.mockImplementation(() => mockOctokit);

    /**
     * Create service instance
     */
    githubService = new GitHubService();
  });

  afterEach(() => {
    /**
     * Clean up environment
     */
    Reflect.deleteProperty(process.env, 'GITHUB_APP_ID');
    Reflect.deleteProperty(process.env, 'GITHUB_APP_SLUG');
    Reflect.deleteProperty(process.env, 'GITHUB_PRIVATE_KEY');
    Reflect.deleteProperty(process.env, 'GITHUB_APP_CLIENT_ID');
    Reflect.deleteProperty(process.env, 'GITHUB_APP_CLIENT_SECRET');
    Reflect.deleteProperty(process.env, 'API_URL');
  });

  describe('getInstallationUrl', () => {
    it('should generate installation URL with state and redirect_url parameters url encoded', () => {
      const state = 'test-state-123';

      const url = githubService.getInstallationUrl(state);

      expect(url).toBe(
        `https://github.com/apps/${testAppSlug}/installations/new?state=${encodeURIComponent(state)}&redirect_url=${encodeURIComponent(`${testApiUrl}/integration/github/oauth`)}`
      );
    });

    it('should throw error if API_URL is not set', () => {
      delete process.env.API_URL;

      const service = new GitHubService();

      expect(() => {
        service.getInstallationUrl('test-state');
      }).toThrow('API_URL environment variable must be set to generate installation URL with redirect_url');
    });
  });

  describe('getInstallationForRepository', () => {
    const mockJwtToken = 'mock-jwt-token';

    it('should get installation information for User account', async () => {
      (jwt.sign as jest.Mock).mockReturnValue(mockJwtToken);

      /* eslint-disable @typescript-eslint/camelcase, camelcase, @typescript-eslint/no-explicit-any */
      mockOctokit.rest.apps.getInstallation.mockResolvedValue({
        data: {
          id: 12345,
          account: {
            login: 'octocat',
            type: 'User',
            id: 1,
            node_id: 'MDQ6VXNlcjE=',
            avatar_url: 'https://github.com/images/error/octocat_happy.gif',
          },
          target_type: 'User',
          permissions: {
            issues: 'write',
            metadata: 'read',
          },
        },
      } as any);
      /* eslint-enable @typescript-eslint/camelcase, camelcase, @typescript-eslint/no-explicit-any */

      const result = await githubService.getInstallationForRepository(testInstallationId);

      expect(result).toEqual({
        id: 12345,
        account: {
          login: 'octocat',
          type: 'User',
        },
        // eslint-disable-next-line @typescript-eslint/camelcase, camelcase
        target_type: 'User',
        permissions: {
          issues: 'write',
          metadata: 'read',
        },
      });

      expect(mockOctokit.rest.apps.getInstallation).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/camelcase, camelcase
        installation_id: parseInt(testInstallationId, 10),
      });
    });

    it('should get installation information for Organization account', async () => {
      (jwt.sign as jest.Mock).mockReturnValue(mockJwtToken);

      /* eslint-disable @typescript-eslint/camelcase, camelcase, @typescript-eslint/no-explicit-any */
      mockOctokit.rest.apps.getInstallation.mockResolvedValue({
        data: {
          id: 12345,
          account: {
            slug: 'my-org',
            type: 'Organization',
            id: 1,
            node_id: 'MDEyOk9yZ2FuaXphdGlvbjE=',
            avatar_url: 'https://github.com/images/error/octocat_happy.gif',
          },
          target_type: 'Organization',
          permissions: {
            issues: 'write',
            metadata: 'read',
          },
        },
      } as any);
      /* eslint-enable @typescript-eslint/camelcase, camelcase, @typescript-eslint/no-explicit-any */

      const result = await githubService.getInstallationForRepository(testInstallationId);

      expect(result).toEqual({
        id: 12345,
        account: {
          login: 'my-org',
          type: 'Organization',
        },
        // eslint-disable-next-line @typescript-eslint/camelcase, camelcase
        target_type: 'Organization',
        permissions: {
          issues: 'write',
          metadata: 'read',
        },
      });
    });

    it('should throw error if request fails', async () => {
      (jwt.sign as jest.Mock).mockReturnValue(mockJwtToken);

      mockOctokit.rest.apps.getInstallation.mockRejectedValue(new Error('Network error'));

      await expect(
        githubService.getInstallationForRepository(testInstallationId)
      ).rejects.toThrow('Failed to get installation');
    });
  });

  describe('createIssue', () => {
    const mockJwtToken = 'mock-jwt-token';
    const mockInstallationToken = 'mock-installation-token';

    beforeEach(() => {
      (jwt.sign as jest.Mock).mockReturnValue(mockJwtToken);

      /* eslint-disable @typescript-eslint/camelcase, camelcase, @typescript-eslint/no-explicit-any */
      mockOctokit.rest.apps.createInstallationAccessToken.mockResolvedValue({
        data: {
          token: mockInstallationToken,
          expires_at: '2025-01-01T00:00:00Z',
        },
      } as any);
      /* eslint-enable @typescript-eslint/camelcase, camelcase, @typescript-eslint/no-explicit-any */
    });

    it('should create issue successfully', async () => {
      const issueData = {
        title: 'Test Issue',
        body: 'Test body',
        labels: [ 'bug' ],
      };

      /* eslint-disable @typescript-eslint/camelcase, camelcase, @typescript-eslint/no-explicit-any */
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: {
          number: 123,
          html_url: 'https://github.com/owner/repo/issues/123',
          title: 'Test Issue',
          state: 'open',
        },
      } as any);
      /* eslint-enable @typescript-eslint/camelcase, camelcase, @typescript-eslint/no-explicit-any */

      const result = await githubService.createIssue('owner/repo', testInstallationId, issueData);

      expect(result).toEqual({
        number: 123,
        // eslint-disable-next-line @typescript-eslint/camelcase, camelcase
        html_url: 'https://github.com/owner/repo/issues/123',
        title: 'Test Issue',
        state: 'open',
      });

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        title: 'Test Issue',
        body: 'Test body',
        labels: [ 'bug' ],
      });
    });

    it('should create issue without labels', async () => {
      const issueData = {
        title: 'Test Issue',
        body: 'Test body',
      };

      /* eslint-disable @typescript-eslint/camelcase, camelcase, @typescript-eslint/no-explicit-any */
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: {
          number: 124,
          html_url: 'https://github.com/owner/repo/issues/124',
          title: 'Test Issue',
          state: 'open',
        },
      } as any);
      /* eslint-enable @typescript-eslint/camelcase, camelcase, @typescript-eslint/no-explicit-any */

      const result = await githubService.createIssue('owner/repo', testInstallationId, issueData);

      expect(result.number).toBe(124);
      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        title: 'Test Issue',
        body: 'Test body',
        labels: undefined,
      });
    });

    it('should throw error for invalid repository name format', async () => {
      const issueData = {
        title: 'Test Issue',
        body: 'Test body',
      };

      await expect(
        githubService.createIssue('invalid-repo-name', testInstallationId, issueData)
      ).rejects.toThrow('Invalid repository name format: invalid-repo-name. Expected format: owner/repo');
    });

    it('should throw error if issue creation fails', async () => {
      const issueData = {
        title: 'Test Issue',
        body: 'Test body',
      };

      mockOctokit.rest.issues.create.mockRejectedValue(new Error('Repository not found'));

      await expect(
        githubService.createIssue('owner/repo', testInstallationId, issueData)
      ).rejects.toThrow('Failed to create issue');
    });
  });

  describe('assignCopilot', () => {
    const mockDelegatedUserToken = 'mock-delegated-user-token';

    it('should assign Copilot to issue successfully', async () => {
      const issueNumber = 123;

      mockOctokit.graphql
        .mockResolvedValueOnce({
          repository: {
            id: 'repo-123',
            issue: { id: 'issue-456' },
            suggestedActors: {
              nodes: [
                {
                  login: 'copilot-swe-agent',
                  __typename: 'Bot',
                  id: 'bot-789',
                },
              ],
            },
          },
        })
        .mockResolvedValueOnce({
          addAssigneesToAssignable: {
            assignable: {
              id: 'issue-456',
              number: issueNumber,
              assignees: { nodes: [] },
            },
          },
        });

      await githubService.assignCopilot('owner/repo', issueNumber, mockDelegatedUserToken);

      expect(mockOctokit.graphql).toHaveBeenCalledTimes(2);
    });

    it('should throw error if assignment fails', async () => {
      const issueNumber = 123;

      mockOctokit.graphql
        .mockResolvedValueOnce({
          repository: {
            id: 'repo-123',
            issue: { id: 'issue-456' },
            suggestedActors: {
              nodes: [
                {
                  login: 'copilot-swe-agent',
                  id: 'bot-789',
                },
              ],
            },
          },
        })
        .mockRejectedValue(new Error('Issue not found'));

      await expect(
        githubService.assignCopilot('owner/repo', issueNumber, mockDelegatedUserToken)
      ).rejects.toThrow('Failed to assign Copilot');
    });
  });
});
