import jwt from 'jsonwebtoken';
import { Octokit } from '@octokit/rest';
import type { Endpoints } from '@octokit/types';

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
   * GitHub App slug/name from environment variables
   */
  private readonly appSlug: string;

  /**
   * Creates an instance of GitHubService
   */
  constructor() {
    if (!process.env.GITHUB_APP_ID) {
      throw new Error('GITHUB_APP_ID environment variable is not set');
    }

    this.appId = process.env.GITHUB_APP_ID;
    this.appSlug = process.env.GITHUB_APP_SLUG || 'hawk-tracker';
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
   */
  public getInstallationUrl(state: string): string {
    if (!process.env.API_URL) {
      throw new Error('API_URL environment variable must be set to generate installation URL with redirect_url');
    }

    /**
     * Form callback URL based on API_URL environment variable
     * This allows different callback URLs for different environments (dev, staging, production)
     */
    const redirectUrl = `${process.env.API_URL}/integration/github/callback`;

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
     * Create Octokit instance with JWT authentication
     */
    const octokit = new Octokit({
      auth: token,
    });

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
     * Create Octokit instance with installation access token
     */
    const octokit = new Octokit({
      auth: accessToken,
    });

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
     * Create Octokit instance with installation access token
     */
    const octokit = new Octokit({
      auth: accessToken,
    });

    try {
      /**
       * Assign GitHub Copilot (github-copilot[bot]) as assignee
       */
      await octokit.rest.issues.addAssignees({
        owner,
        repo,
        issue_number: issueNumber,
        assignees: ['github-copilot[bot]'],
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
     * Create Octokit instance with JWT authentication
     */
    const octokit = new Octokit({
      auth: token,
    });

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
}
