import express from 'express';
import SamlController from './controller';
import { ContextFactories } from '../../types/graphql';

/**
 * Create SAML router
 *
 * @param factories - context factories for database access
 * @returns Express router with SAML endpoints
 */
export function createSamlRouter(factories: ContextFactories): express.Router {
  const router = express.Router();
  const controller = new SamlController(factories);

  /**
   * SSO login initiation
   * GET /auth/sso/saml/:workspaceId
   */
  router.get('/:workspaceId', async (req, res, next) => {
    try {
      await controller.initiateLogin(req, res);
    } catch (error) {
      next(error);
    }
  });

  /**
   * ACS callback
   * POST /auth/sso/saml/:workspaceId/acs
   */
  router.post('/:workspaceId/acs', async (req, res, next) => {
    try {
      await controller.handleAcs(req, res);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

