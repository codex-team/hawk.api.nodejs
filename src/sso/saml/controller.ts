import express from 'express';
import { v4 as uuid } from 'uuid';
import { ObjectId } from 'mongodb';
import SamlService from './service';
import samlStore from './store';
import { ContextFactories } from '../../types/graphql';
import { SamlResponseData } from '../types';
import WorkspaceModel from '../../models/workspace';
import UserModel from '../../models/user';
import { sgr, Effect } from '../../utils/ansi';

/**
 * Controller for SAML SSO endpoints
 */
export default class SamlController {
  /**
   * SAML service instance
   */
  private samlService: SamlService;

  /**
   * Context factories for database access
   */
  private factories: ContextFactories;

  constructor(factories: ContextFactories) {
    this.samlService = new SamlService();
    this.factories = factories;
  }

  /**
   * Log message with SSO prefix
   *
   * @param level - log level ('log', 'warn', 'error', 'info', 'success')
   * @param args - arguments to log
   */
  private log(level: 'log' | 'warn' | 'error' | 'info' | 'success', ...args: unknown[]): void {
    const colors = {
      log: Effect.ForegroundGreen,
      warn: Effect.ForegroundYellow,
      error: Effect.ForegroundRed,
      info: Effect.ForegroundBlue,
      success: [Effect.ForegroundGreen, Effect.Bold],
    };

    const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

    logger(sgr('[SSO]', colors[level]), ...args);
  }

  /**
   * Validate workspace ID format
   *
   * @param workspaceId - workspace ID to validate
   * @returns true if valid, false otherwise
   */
  private isValidWorkspaceId(workspaceId: string): boolean {
    return ObjectId.isValid(workspaceId);
  }

  /**
   * Compose Assertion Consumer Service URL for workspace
   *
   * @param workspaceId - workspace ID
   * @returns ACS URL
   */
  private getAcsUrl(workspaceId: string): string {
    const apiUrl = process.env.API_URL || 'https://api.hawk.so';
    return `${apiUrl}/auth/sso/saml/${workspaceId}/acs`;
  }

  /**
   * Initiate SSO login (GET /auth/sso/saml/:workspaceId)
   */
  public async initiateLogin(req: express.Request, res: express.Response): Promise<void> {
    const { workspaceId } = req.params;

    try {
      const returnUrl = (req.query.returnUrl as string) || `/workspace/${workspaceId}`;

      /**
       * Validate workspace ID format
       */
      if (!this.isValidWorkspaceId(workspaceId)) {
        this.log('warn', 'Invalid workspace ID format:', sgr(workspaceId, Effect.ForegroundRed));
        res.status(400).json({ error: 'Invalid workspace ID' });
        return;
      }

      /**
       * 1. Check if workspace has SSO enabled
       */
      const workspace = await this.factories.workspacesFactory.findById(workspaceId);

      if (!workspace || !workspace.sso?.enabled) {
        this.log('warn', 'SSO not enabled for workspace:', sgr(workspaceId, Effect.ForegroundCyan));
        res.status(400).json({ error: 'SSO is not enabled for this workspace' });
        return;
      }

      /**
       * 2. Compose Assertion Consumer Service URL
       */
      const acsUrl = this.getAcsUrl(workspaceId);
      const relayStateId = uuid();

      /**
       * 3. Save RelayState to temporary storage
       */
      samlStore.saveRelayState(relayStateId, { returnUrl, workspaceId });

      /**
       * 4. Generate AuthnRequest
       */
      const { requestId, encodedRequest } = await this.samlService.generateAuthnRequest(
        workspaceId,
        acsUrl,
        relayStateId,
        workspace.sso.saml
      );

      /**
       * 5. Save AuthnRequest ID for InResponseTo validation
       */
      samlStore.saveAuthnRequest(requestId, workspaceId);

      /**
       * 6. Redirect to IdP
       */
      const redirectUrl = new URL(workspace.sso.saml.ssoUrl);
      redirectUrl.searchParams.set('SAMLRequest', encodedRequest);
      redirectUrl.searchParams.set('RelayState', relayStateId);

      this.log(
        'log',
        'Initiating SSO login for workspace:',
        sgr(workspaceId, [Effect.ForegroundCyan, Effect.Bold]),
        '| Request ID:',
        sgr(requestId.slice(0, 8), Effect.ForegroundGray)
      );

      res.redirect(redirectUrl.toString());
    } catch (error) {
      this.log(
        'error',
        'SSO initiation error for workspace:',
        sgr(workspaceId, Effect.ForegroundCyan),
        '|',
        sgr(error instanceof Error ? error.message : 'Unknown error', Effect.ForegroundRed)
      );
      res.status(500).json({ error: 'Failed to initiate SSO login' });
    }
  }

  /**
   * Handle ACS callback (POST /auth/sso/saml/:workspaceId/acs)
   */
  public async handleAcs(req: express.Request, res: express.Response): Promise<void> {
    const { workspaceId } = req.params;

    try {
      const samlResponse = req.body.SAMLResponse as string;
      const relayStateId = req.body.RelayState as string;

      /**
       * Validate workspace ID format
       */
      if (!this.isValidWorkspaceId(workspaceId)) {
        this.log('warn', '[ACS] Invalid workspace ID format:', sgr(workspaceId, Effect.ForegroundRed));
        res.status(400).json({ error: 'Invalid workspace ID' });
        return;
      }

      /**
       * Validate required SAML response
       */
      if (!samlResponse) {
        this.log('warn', '[ACS] Missing SAML response for workspace:', sgr(workspaceId, Effect.ForegroundCyan));
        res.status(400).json({ error: 'SAML response is required' });
        return;
      }

      /**
       * 1. Get workspace SSO configuration and check if SSO is enabled
       */
      const workspace = await this.factories.workspacesFactory.findById(workspaceId);

      if (!workspace || !workspace.sso?.enabled) {
        this.log('warn', '[ACS] SSO not enabled for workspace:', sgr(workspaceId, Effect.ForegroundCyan));
        res.status(400).json({ error: 'SSO is not enabled for this workspace' });
        return;
      }

      /**
       * 2. Validate and parse SAML Response
       */
      const acsUrl = this.getAcsUrl(workspaceId);

      let samlData: SamlResponseData;

      try {
        /**
         * Validate and parse SAML Response
         * Note: InResponseTo validation is done separately after parsing
         */
        samlData = await this.samlService.validateAndParseResponse(
          samlResponse,
          workspaceId,
          acsUrl,
          workspace.sso.saml
        );

        this.log(
          'log',
          '[ACS] SAML response validated for workspace:',
          sgr(workspaceId, Effect.ForegroundCyan),
          '| User:',
          sgr(samlData.email, [Effect.ForegroundMagenta, Effect.Bold])
        );

        /**
         * Validate InResponseTo against stored AuthnRequest
         */
        if (samlData.inResponseTo) {
          const isValidRequest = samlStore.validateAndConsumeAuthnRequest(
            samlData.inResponseTo,
            workspaceId
          );

          if (!isValidRequest) {
            this.log(
              'error',
              '[ACS] InResponseTo validation failed for workspace:',
              sgr(workspaceId, Effect.ForegroundCyan),
              '| Request ID:',
              sgr(samlData.inResponseTo.slice(0, 8), Effect.ForegroundGray)
            );
            res.status(400).json({ error: 'Invalid SAML response: InResponseTo validation failed' });
            return;
          }
        }
      } catch (error) {
        this.log(
          'error',
          '[ACS] SAML validation error for workspace:',
          sgr(workspaceId, Effect.ForegroundCyan),
          '|',
          sgr(error instanceof Error ? error.message : 'Unknown error', Effect.ForegroundRed)
        );
        res.status(400).json({ error: 'Invalid SAML response' });
        return;
      }

      /**
       * 3. Find or create user
       */
      let user = await this.factories.usersFactory.findBySamlIdentity(workspaceId, samlData.nameId);

      if (!user) {
        /**
         * JIT provisioning or invite-only policy
         */
        this.log(
          'info',
          '[ACS] User not found, starting provisioning:',
          sgr(samlData.email, Effect.ForegroundMagenta),
          '| Workspace:',
          sgr(workspaceId, Effect.ForegroundCyan)
        );
        user = await this.handleUserProvisioning(workspaceId, samlData, workspace);
      } else {
        this.log(
          'log',
          '[ACS] Existing user found:',
          sgr(samlData.email, Effect.ForegroundMagenta),
          '| User ID:',
          sgr(user._id.toString().slice(0, 8), Effect.ForegroundGray)
        );
      }

      /**
       * 4. Get RelayState for return URL (before consuming)
       * Note: RelayState is consumed after first use, so we need to get it before validation
       */
      const relayState = samlStore.getRelayState(relayStateId);
      const finalReturnUrl = relayState?.returnUrl || `/workspace/${workspaceId}`;

      /**
       * 5. Create Hawk session
       */
      const tokens = await user.generateTokensPair();

      /**
       * 6. Redirect to Garage with tokens
       */
      const frontendUrl = new URL(finalReturnUrl, process.env.GARAGE_URL || 'http://localhost:3000');
      frontendUrl.searchParams.set('access_token', tokens.accessToken);
      frontendUrl.searchParams.set('refresh_token', tokens.refreshToken);

      this.log(
        'success',
        '[ACS] ✓ SSO login successful:',
        sgr(samlData.email, [Effect.ForegroundMagenta, Effect.Bold]),
        '| Workspace:',
        sgr(workspaceId, Effect.ForegroundCyan),
        '| Redirecting to:',
        sgr(finalReturnUrl, Effect.ForegroundGray)
      );

      res.redirect(frontendUrl.toString());
    } catch (error) {
      /**
       * Handle specific error types
       */
      if (error instanceof Error && error.message.includes('SAML')) {
        this.log(
          'error',
          '[ACS] SAML processing error for workspace:',
          sgr(workspaceId, Effect.ForegroundCyan),
          '|',
          sgr(error.message, Effect.ForegroundRed)
        );
        res.status(400).json({ error: 'Invalid SAML response' });
        return;
      }

      this.log(
        'error',
        '[ACS] ACS callback error for workspace:',
        sgr(workspaceId, Effect.ForegroundCyan),
        '|',
        sgr(error instanceof Error ? error.message : 'Unknown error', Effect.ForegroundRed)
      );
      res.status(500).json({ error: 'Failed to process SSO callback' });
    }
  }

  /**
   * Handle user provisioning (JIT or invite-only)
   *
   * @param workspaceId - workspace ID
   * @param samlData - parsed SAML response data
   * @param workspace - workspace model
   * @returns UserModel instance
   */
  private async handleUserProvisioning(
    workspaceId: string,
    samlData: SamlResponseData,
    workspace: WorkspaceModel
  ): Promise<UserModel> {
    try {
      /**
       * Find user by email
       */
      let user = await this.factories.usersFactory.findByEmail(samlData.email);

      if (!user) {
        /**
         * Create new user (JIT provisioning)
         * Password is not set - only SSO login is allowed
         */
        this.log(
          'info',
          '[Provisioning] Creating new user:',
          sgr(samlData.email, [Effect.ForegroundMagenta, Effect.Bold]),
          '| Workspace:',
          sgr(workspaceId, Effect.ForegroundCyan)
        );
        user = await this.factories.usersFactory.create(samlData.email, undefined, undefined);
      }

      /**
       * Link SAML identity to user
       */
      this.log(
        'info',
        '[Provisioning] Linking SAML identity for user:',
        sgr(samlData.email, Effect.ForegroundMagenta),
        '| NameID:',
        sgr(samlData.nameId.slice(0, 16) + '...', Effect.ForegroundGray)
      );
      await user.linkSamlIdentity(workspaceId, samlData.nameId, samlData.email);

      /**
       * Check if user is a member of the workspace
       */
      const member = await workspace.getMemberInfo(user._id.toString());

      if (!member) {
        /**
         * Add user to workspace (JIT provisioning)
         */
        this.log(
          'log',
          '[Provisioning] Adding user to workspace:',
          sgr(samlData.email, Effect.ForegroundMagenta),
          '| Workspace:',
          sgr(workspaceId, Effect.ForegroundCyan)
        );
        await workspace.addMember(user._id.toString());
        await user.addWorkspace(workspaceId);
      } else if (WorkspaceModel.isPendingMember(member)) {
        /**
         * Confirm pending membership
         */
        this.log(
          'log',
          '[Provisioning] Confirming pending membership:',
          sgr(samlData.email, Effect.ForegroundMagenta),
          '| Workspace:',
          sgr(workspaceId, Effect.ForegroundCyan)
        );
        await workspace.confirmMembership(user);
        await user.confirmMembership(workspaceId);
      } else {
        this.log(
          'log',
          '[Provisioning] User already member of workspace:',
          sgr(samlData.email, Effect.ForegroundMagenta)
        );
      }

      this.log(
        'success',
        '[Provisioning] ✓ User provisioning completed:',
        sgr(samlData.email, [Effect.ForegroundMagenta, Effect.Bold]),
        '| User ID:',
        sgr(user._id.toString(), Effect.ForegroundGray)
      );

      return user;
    } catch (error) {
      this.log(
        'error',
        '[Provisioning] Provisioning error for user:',
        sgr(samlData.email, Effect.ForegroundMagenta),
        '| Workspace:',
        sgr(workspaceId, Effect.ForegroundCyan),
        '|',
        sgr(error instanceof Error ? error.message : 'Unknown error', Effect.ForegroundRed)
      );
      throw error;
    }
  }
}

