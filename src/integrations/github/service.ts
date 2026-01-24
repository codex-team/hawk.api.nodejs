import jwt from 'jsonwebtoken';
import { Octokit } from '@octokit/rest';
import type { Endpoints } from '@octokit/types';
import { exchangeWebFlowCode, refreshToken as refreshOAuthToken } from '@octokit/oauth-methods';

/**
 * Type for GitHub Issue creation parameters
 * Extracted from Octokit types for POST /repos/{owner}/{repo}/issues
 */
export type IssueData = Pick<
  Endpoints['POST /repos/{owner}/{repo}/issues']['parameters'],
  'title' | 'body' | 'labels'
>;

/**
 * Type for GitHub Issue response data
 * Extracted from Octokit types for POST /repos/{owner}/{repo}/issues response
 */
export type GitHubIssue = Pick<
  Endpoints['POST /repos/{owner}/{repo}/issues']['response']['data'],
  'number' | 'html_url' | 'title' | 'state'
>;

/**
 * Type for GitHub Repository data
 * Ephemeral data, not stored in database
 */
export type Repository = {
  /**
   * Repository ID
   */
  id: string;

  /**
   * Repository name (without owner)
   */
  name: string;

  /**
   * Repository full name (owner/repo)
   */
  fullName: string;

  /**
   * Whether repository is private
   */
  private: boolean;

  /**
   * Repository HTML URL
   */
  htmlUrl: string;

  /**
   * Last update date
   */
  updatedAt: Date;

  /**
   * Primary programming language
   */
  language: string | null;
};

/**
 * Type for GitHub Installation response data
 * Simplified version of Octokit Installation type with essential fields only
 * account.login and account.type are extracted from the full GitHub account object
 */
export type Installation = {
  /**
   * Installation ID
   */
  id: number;

  /**
   * Account (user or organization) that installed the app
   */
  account: {
    login: string;
    type: string;
  };

  /**
   * Installation target type
   */
  target_type: string;

  /**
   * Permissions granted to the app
   */
  permissions: Record<string, string>;
};

/**
 * Service for interacting with GitHub API
 */
export class GitHubService {
  /**
   * GitHub App ID from environment variables
   */
  private readonly appId: string;

  /**
   * GitHub App Client ID from environment variables
   * Required for OAuth token exchange (different from App ID)
   */
  private readonly clientId: string;

  /**
   * GitHub App slug/name from environment variables
   */
  private readonly appSlug: string;

  /**
   * GitHub App Client Secret from environment variables
   * Required for OAuth token exchange
   */
  private readonly clientSecret: string;

  /**
   * Default timeout for GitHub API requests (in milliseconds)
   * Increased from default 10s to 60s to handle slow network connections
   */
  private static readonly DEFAULT_TIMEOUT = 60000;

  /**
   * Creates an instance of GitHubService
   */
  constructor() {
    if (!process.env.GITHUB_APP_ID) {
      throw new Error('GITHUB_APP_ID environment variable is not set');
    }

    if (!process.env.GITHUB_APP_CLIENT_ID) {
      throw new Error('GITHUB_APP_CLIENT_ID environment variable is not set');
    }

    if (!process.env.GITHUB_APP_CLIENT_SECRET) {
      throw new Error('GITHUB_APP_CLIENT_SECRET environment variable is not set');
    }

    this.appId = process.env.GITHUB_APP_ID;
    this.clientId = process.env.GITHUB_APP_CLIENT_ID;
    this.appSlug = process.env.GITHUB_APP_SLUG || 'hawk-tracker';
    this.clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;
  }

  /**
   * Create Octokit instance with configured timeout
   *
   * @param auth - Authentication token (JWT or installation access token)
   * @returns Configured Octokit instance
   */
  private createOctokit(auth: string): Octokit {
    return new Octokit({
      auth,
      request: {
        timeout: GitHubService.DEFAULT_TIMEOUT,
      },
    });
  }

  /**
   * Generate URL for GitHub App installation
   *
   * @param {string} state - State parameter for CSRF protection and context preservation.
   *                         GitHub will return this value unchanged in the callback URL,
   *                         allowing you to verify that the callback corresponds to the original installation request.
   *                         Typically this is a JWT token or a random string (UUID) that serves as a key
   *                         to retrieve stored context data (projectId, userId, etc.) from Redis or session storage.
   *
   *                         Example values:
   *                         - JWT: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwcm9qZWN0SWQiOiI2NzgiLCJ1c2VySWQiOiIxMjMiLCJ0aW1lc3RhbXAiOjE3MDk4NzY1NDB9..."
   *                         - UUID: "550e8400-e29b-41d4-a716-446655440000"
   *
   * @returns {string} Installation URL with state and redirect_url parameters
   *
   * Note: Both Setup URL (in GitHub App settings) and redirect_url parameter can be used.
   * The redirect_url parameter takes precedence if provided. We use redirect_url to ensure
   * the state parameter is properly passed to our callback endpoint.
   */
  public getInstallationUrl(state: string): string {
    if (!process.env.API_URL) {
      throw new Error('API_URL environment variable must be set to generate installation URL with redirect_url');
    }

    /**
     * Form callback URL based on API_URL environment variable
     * This allows different callback URLs for different environments (dev, staging, production)
     * The redirect_url parameter ensures GitHub redirects to our callback with state preserved
     * Note: When "Request user authorization (OAuth) during installation" is enabled,
     * GitHub redirects to /oauth with both installation_id and code parameters
     */
    const redirectUrl = `${process.env.API_URL}/integration/github/oauth`;

    /**
     * Include both state and redirect_url parameters
     * The redirect_url parameter ensures GitHub redirects to our callback endpoint
     * even if Setup URL is configured differently in GitHub App settings
     */
    return `https://github.com/apps/${this.appSlug}/installations/new?state=${encodeURIComponent(state)}&redirect_url=${encodeURIComponent(redirectUrl)}`;
  }

  /**
   * Get installation information
   *
   * Installation represents a GitHub App installation in a user's or organization's account.
   * When a user or organization installs a GitHub App, GitHub creates an Installation object
   * that links the app to the account and grants specific permissions to the app for accessing
   * repositories and resources. This installation is required to generate installation access tokens
   * that allow the app to make API calls on behalf of the installation.
   *
   * @param {string} installationId - GitHub App installation ID (unique identifier for the installation)
   * @returns {Promise<Installation>} Installation information containing:
   *                                   - id: Installation ID
   *                                   - account: User or organization that installed the app (with login and type)
   *                                   - target_type: Type of target (User or Organization)
   *                                   - permissions: Permissions granted to the app for this installation
   * @throws {Error} If request fails
   */
  public async getInstallationForRepository(installationId: string): Promise<Installation> {
    const token = this.createJWT();

    /**
     * Create Octokit instance with JWT authentication and configured timeout
     */
    const octokit = this.createOctokit(token);

    try {
      const { data } = await octokit.rest.apps.getInstallation({
        installation_id: parseInt(installationId, 10),
      });

      /**
       * Extract account login and type
       * account can be User (has 'login' and 'type') or Organization (has 'slug' but not 'login')
       */
      let accountLogin = '';
      let accountType = '';

      if (data.account) {
        /**
         * Check if account has 'login' property (User) or 'slug' property (Organization)
         */
        if ('login' in data.account) {
          accountLogin = data.account.login;
          accountType = 'login' in data.account && 'type' in data.account ? data.account.type : 'User';
        } else if ('slug' in data.account) {
          /**
           * For Organization, use 'slug' as login identifier
           */
          accountLogin = data.account.slug;
          accountType = 'Organization';
        }
      }

      return {
        id: data.id,
        account: {
          login: accountLogin,
          type: accountType,
        },
        target_type: data.target_type,
        permissions: data.permissions || {},
      };
    } catch (error) {
      throw new Error(`Failed to get installation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get list of repositories accessible to GitHub App installation
   *
   * @param {string} installationId - GitHub App installation ID
   * @returns {Promise<Repository[]>} Array of repositories accessible to the installation
   * @throws {Error} If request fails
   */
  public async getRepositoriesForInstallation(installationId: string): Promise<Repository[]> {
    /**
     * Get installation access token
     */
    const accessToken = await this.createInstallationToken(installationId);

    /**
     * Create Octokit instance with installation access token and configured timeout
     */
    const octokit = this.createOctokit(accessToken);

    try {
      /**
       * Get installation info using JWT token (not installation access token)
       * This is needed to check what account/organization it's installed on
       */
      const jwtToken = this.createJWT();
      const jwtOctokit = this.createOctokit(jwtToken);

      const installationInfo = await jwtOctokit.rest.apps.getInstallation({
        installation_id: parseInt(installationId, 10),
      });

      /**
       * Log installation info for debugging
       */
      console.log('Installation info:', {
        id: installationInfo.data.id,
        account: installationInfo.data.account,
        target_type: installationInfo.data.target_type,
        repository_selection: installationInfo.data.repository_selection,
      });

      /**
       * Get all repositories accessible to the installation
       * Use Octokit's paginate helper to automatically fetch all pages
       * This ensures we get repositories from both personal accounts and organizations
       * Use installation access token for this call
       */
      const repositoriesData = await octokit.paginate(
        octokit.rest.apps.listReposAccessibleToInstallation,
        {
          installation_id: parseInt(installationId, 10),
          per_page: 100,
        }
      );

      console.log(`Total repositories fetched: ${repositoriesData.length}`);

      /**
       * Transform GitHub repository objects to our Repository type
       * Sort by updatedAt descending (newest first)
       */
      const repositories = repositoriesData.map((repo) => ({
        id: repo.id.toString(),
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private || false,
        htmlUrl: repo.html_url,
        updatedAt: repo.updated_at ? new Date(repo.updated_at) : new Date(0),
        language: repo.language || null,
      }));

      /**
       * Sort repositories by updatedAt descending (newest first)
       */
      return repositories.sort((a, b) => {
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });
    } catch (error) {
      throw new Error(`Failed to get repositories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a GitHub issue
   *
   * @param {string} repoFullName - Repository full name (owner/repo)
   * @param {string} installationId - GitHub App installation ID
   * @param {IssueData} issueData - Issue data (title, body, labels)
   * @returns {Promise<GitHubIssue>} Created issue
   * @throws {Error} If issue creation fails
   */
  public async createIssue(
    repoFullName: string,
    installationId: string,
    issueData: IssueData
  ): Promise<GitHubIssue> {
    const [owner, repo] = repoFullName.split('/');

    if (!owner || !repo) {
      throw new Error(`Invalid repository name format: ${repoFullName}. Expected format: owner/repo`);
    }

    /**
     * Get installation access token
     */
    const accessToken = await this.createInstallationToken(installationId);

    /**
     * Create Octokit instance with installation access token and configured timeout
     */
    const octokit = this.createOctokit(accessToken);

    try {
      const { data } = await octokit.rest.issues.create({
        owner,
        repo,
        title: issueData.title,
        body: issueData.body,
        labels: issueData.labels,
      });

      return {
        number: data.number,
        html_url: data.html_url,
        title: data.title,
        state: data.state,
      };
    } catch (error) {
      throw new Error(`Failed to create issue: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Assign GitHub Copilot to an issue
   *
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} issueNumber - Issue number
   * @param {string} installationId - GitHub App installation ID
   * @returns {Promise<boolean>} True if assignment was successful
   * @throws {Error} If assignment fails
   */
  public async assignCopilot(
    owner: string,
    repo: string,
    issueNumber: number,
    installationId: string
  ): Promise<boolean> {
    /**
     * Get installation access token
     */
    const accessToken = await this.createInstallationToken(installationId);

    /**
     * Create Octokit instance with installation access token and configured timeout
     */
    const octokit = this.createOctokit(accessToken);

    try {
      /**
       * Assign GitHub Copilot coding agent (copilot-swe-agent[bot]) as assignee
       * According to GitHub docs: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-a-pr
       */
      await octokit.rest.issues.addAssignees({
        owner,
        repo,
        issue_number: issueNumber,
        assignees: ['copilot-swe-agent[bot]'],
      });

      return true;
    } catch (error) {
      throw new Error(`Failed to assign Copilot: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get private key from environment variables or file
   *
   * @returns {string} Private key in PEM format with real newlines
   * @throws {Error} If GITHUB_PRIVATE_KEY is not set
   */
  private getPrivateKey(): string {
    if (process.env.GITHUB_PRIVATE_KEY) {
      /**
       * Get private key from environment variable
       * dotenv v16+ handles both multiline strings and escaped \n automatically
       * But we check if there are literal \n sequences (not actual newlines) and replace them
       */
      let privateKey = process.env.GITHUB_PRIVATE_KEY;

      /**
       * Check if the string contains literal \n (backslash followed by n) instead of actual newlines
       * This can happen if the value was stored as a single line with escaped newlines
       */
      if (privateKey.includes('\\n') && !privateKey.includes('\n')) {
        /**
         * Replace literal \n with actual newlines
         */
        privateKey = privateKey.replace(/\\n/g, '\n');
      }

      return privateKey;
    }

    throw new Error('GITHUB_PRIVATE_KEY must be set');
  }

  /**
   * Create JWT token for GitHub App authentication
   *
   * @returns {string} JWT token
   */
  private createJWT(): string {
    const privateKey = this.getPrivateKey();
    const now = Math.floor(Date.now() / 1000);

    /**
     * JWT payload for GitHub App
     * - iat: issued at time (current time)
     * - exp: expiration time (10 minutes from now, GitHub allows up to 10 minutes)
     * - iss: issuer (GitHub App ID)
     */
    const payload = {
      iat: now - 60, // Allow 1 minute clock skew
      exp: now + 600, // 10 minutes expiration
      iss: this.appId,
    };

    return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
  }

  /**
   * Get installation access token from GitHub API
   *
   * @param {string} installationId - GitHub App installation ID
   * @returns {Promise<string>} Installation access token (valid for 1 hour)
   * @throws {Error} If token creation fails
   */
  private async createInstallationToken(installationId: string): Promise<string> {
    const token = this.createJWT();

    /**
     * Create Octokit instance with JWT authentication and configured timeout
     */
    const octokit = this.createOctokit(token);

    try {
      /**
       * Request installation access token
       */
      const { data } = await octokit.rest.apps.createInstallationAccessToken({
        installation_id: parseInt(installationId, 10),
      });

      return data.token;
    } catch (error) {
      throw new Error(`Failed to create installation token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Exchange OAuth authorization code for user-to-server access token
   * This token allows the GitHub App to perform actions on behalf of the user
   *
   * @param code - OAuth authorization code from GitHub callback
   * @param redirectUri - Redirect URI that was used in the OAuth authorization request (must match)
   * @returns Tokens and user info
   * @throws If token exchange fails
   */
  public async exchangeOAuthCodeForToken(
    code: string,
    redirectUri?: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date | null;
    refreshTokenExpiresAt: Date | null;
    user: { id: number; login: string };
  }> {
    try {
      /**
       * Build redirect URI if not provided
       */
      if (!redirectUri) {
        if (!process.env.API_URL) {
          throw new Error('API_URL environment variable must be set to generate redirect URI');
        }

        redirectUri = `${process.env.API_URL}/integration/github/oauth`;
      }

      /**
       * Use Octokit OAuth methods for token exchange
       * This is the recommended way to exchange OAuth code for access token
       */
      const { authentication } = await exchangeWebFlowCode({
        clientType: 'github-app',
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        code,
        redirectUrl: redirectUri,
      });


      if (!authentication.token) {
        throw new Error('No access token in OAuth response');
      }

      const accessToken = authentication.token;
      /**
       * refreshToken, expiresAt, and refreshTokenExpiresAt are only available in certain authentication types
       * Use type guards to safely access these properties
       */
      const refreshToken = 'refreshToken' in authentication && authentication.refreshToken
        ? authentication.refreshToken
        : '';
      const expiresAt = 'expiresAt' in authentication && authentication.expiresAt
        ? new Date(authentication.expiresAt)
        : null;
      const refreshTokenExpiresAt = 'refreshTokenExpiresAt' in authentication && authentication.refreshTokenExpiresAt
        ? new Date(authentication.refreshTokenExpiresAt)
        : null;

      /**
       * Get user info using the access token
       */
      const octokit = this.createOctokit(accessToken);
      const { data: userData } = await octokit.rest.users.getAuthenticated();

      return {
        accessToken,
        refreshToken,
        expiresAt,
        refreshTokenExpiresAt,
        user: {
          id: userData.id,
          login: userData.login,
        },
      };
    } catch (error) {
      throw new Error(`Failed to exchange OAuth code for token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate user-to-server access token by making GET /user request
   * Updates tokenLastValidatedAt if validation succeeds
   *
   * @param {string} accessToken - User-to-server access token
   * @returns {Promise<{ valid: boolean; user?: { id: number; login: string }; status: 'active' | 'revoked' }>} Validation result
   */
  public async validateUserToken(accessToken: string): Promise<{ valid: boolean; user?: { id: number; login: string }; status: 'active' | 'revoked' }> {
    try {
      const octokit = this.createOctokit(accessToken);
      const { data: userData } = await octokit.rest.users.getAuthenticated();

      return {
        valid: true,
        user: {
          id: userData.id,
          login: userData.login,
        },
        status: 'active',
      };
    } catch (error: any) {
      /**
       * Check if error is 401 or 403 (token revoked/invalid)
       */
      if (error?.status === 401 || error?.status === 403) {
        return {
          valid: false,
          status: 'revoked',
        };
      }

      /**
       * Other errors (network, etc.) - consider token as potentially valid
       * but log the error
       */
      throw new Error(`Failed to validate user token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Refresh user-to-server access token using refresh token
   * Rotates refresh token if a new one is provided
   *
   * @param {string} refreshToken - OAuth refresh token
   * @returns {Promise<{ accessToken: string; refreshToken: string; expiresAt: Date | null; refreshTokenExpiresAt: Date | null }>} New tokens
   * @throws {Error} If token refresh fails
   */
  public async refreshUserToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date | null;
    refreshTokenExpiresAt: Date | null;
  }> {
    try {
      const { authentication } = await refreshOAuthToken({
        clientType: 'github-app',
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        refreshToken,
      });

      if (!authentication.token) {
        throw new Error('No access token in refresh response');
      }

      /**
       * refreshToken is only available in GitHubAppAuthenticationWithRefreshToken type
       * Check if it exists before accessing
       */
      const newRefreshToken = 'refreshToken' in authentication
        ? authentication.refreshToken || refreshToken
        : refreshToken; // Use new refresh token if provided, otherwise keep old one

      return {
        accessToken: authentication.token,
        refreshToken: newRefreshToken,
        expiresAt: 'expiresAt' in authentication && authentication.expiresAt
          ? new Date(authentication.expiresAt)
          : null,
        refreshTokenExpiresAt: 'refreshTokenExpiresAt' in authentication && authentication.refreshTokenExpiresAt
          ? new Date(authentication.refreshTokenExpiresAt)
          : null,
      };
    } catch (error) {
      throw new Error(`Failed to refresh user token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
