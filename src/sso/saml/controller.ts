import express from 'express';
import SamlService from './service';
import samlStore from './store';
import { ContextFactories } from '../../types/graphql';

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
    /**
     * TODO: Implement according to specification
     */
    throw new Error('Not implemented');
  }

  /**
   * Handle ACS callback (POST /auth/sso/saml/:workspaceId/acs)
   */
  public async handleAcs(req: express.Request, res: express.Response): Promise<void> {
    /**
     * TODO: Implement according to specification
     */
    throw new Error('Not implemented');
  }
}

