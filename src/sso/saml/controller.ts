import express from 'express';
import { v4 as uuid } from 'uuid';
import { ObjectId } from 'mongodb';
import SamlService from './service';
import samlStore from './store';
import { ContextFactories } from '../../types/graphql';
import { SamlResponseData } from '../types';
import WorkspaceModel from '../../models/workspace';
import UserModel from '../../models/user';

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
    try {
      const { workspaceId } = req.params;
      const returnUrl = (req.query.returnUrl as string) || `/workspace/${workspaceId}`;

      /**
       * Validate workspace ID format
       */
      if (!this.isValidWorkspaceId(workspaceId)) {
        res.status(400).json({ error: 'Invalid workspace ID' });
        return;
      }

      /**
       * 1. Check if workspace has SSO enabled
       */
      const workspace = await this.factories.workspacesFactory.findById(workspaceId);

      if (!workspace || !workspace.sso?.enabled) {
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

      res.redirect(redirectUrl.toString());
    } catch (error) {
      console.error('SSO initiation error:', {
        workspaceId: req.params.workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({ error: 'Failed to initiate SSO login' });
    }
  }

  /**
   * Handle ACS callback (POST /auth/sso/saml/:workspaceId/acs)
   */
  public async handleAcs(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const samlResponse = req.body.SAMLResponse as string;
      const relayStateId = req.body.RelayState as string;

      /**
       * Validate workspace ID format
       */
      if (!this.isValidWorkspaceId(workspaceId)) {
        res.status(400).json({ error: 'Invalid workspace ID' });
        return;
      }

      /**
       * Validate required SAML response
       */
      if (!samlResponse) {
        res.status(400).json({ error: 'SAML response is required' });
        return;
      }

      /**
       * 1. Get workspace SSO configuration and check if SSO is enabled
       */
      const workspace = await this.factories.workspacesFactory.findById(workspaceId);

      if (!workspace || !workspace.sso?.enabled) {
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

        /**
         * Validate InResponseTo against stored AuthnRequest
         */
        if (samlData.inResponseTo) {
          const isValidRequest = samlStore.validateAndConsumeAuthnRequest(
            samlData.inResponseTo,
            workspaceId
          );

          if (!isValidRequest) {
            res.status(400).json({ error: 'Invalid SAML response: InResponseTo validation failed' });
            return;
          }
        }
      } catch (error) {
        console.error('SAML validation error:', {
          workspaceId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
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
        user = await this.handleUserProvisioning(workspaceId, samlData, workspace);
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

      res.redirect(frontendUrl.toString());
    } catch (error) {
      /**
       * Handle specific error types
       */
      if (error instanceof Error && error.message.includes('SAML')) {
        console.error('SAML processing error:', {
          workspaceId: req.params.workspaceId,
          error: error.message,
        });
        res.status(400).json({ error: 'Invalid SAML response' });
        return;
      }

      console.error('ACS callback error:', {
        workspaceId: req.params.workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
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
    /**
     * Find user by email
     */
    let user = await this.factories.usersFactory.findByEmail(samlData.email);

    if (!user) {
      /**
       * Create new user (JIT provisioning)
       * Password is not set - only SSO login is allowed
       */
      user = await this.factories.usersFactory.create(samlData.email, undefined, undefined);
    }

    /**
     * Link SAML identity to user
     */
    await user.linkSamlIdentity(workspaceId, samlData.nameId, samlData.email);

    /**
     * Check if user is a member of the workspace
     */
    const member = await workspace.getMemberInfo(user._id.toString());

    if (!member) {
      /**
       * Add user to workspace (JIT provisioning)
       */
      await workspace.addMember(user._id.toString());
      await user.addWorkspace(workspaceId);
    } else if (WorkspaceModel.isPendingMember(member)) {
      /**
       * Confirm pending membership
       */
      await workspace.confirmMembership(user);
      await user.confirmMembership(workspaceId);
    }

    return user;
  }
}

