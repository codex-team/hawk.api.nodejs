import '../../typeDefs/expressContext';
import express from 'express';
import { getEventsFactory } from '../../resolvers/helpers/eventsFactory';
import { checkUserInWorkspaceByProjectId } from '../../directives/requireUserInWorkspace';
import { askAiService } from './service';

/**
 * Verify the requesting user is a member of the project's workspace.
 *
 * @param req - Express request
 * @param res - Express response
 * @param projectId - project id from query parameters (may be string[] if repeated)
 * @returns user id and validated project id if authorized, {@code null} otherwise (response already sent)
 */
async function authorizeProjectAccess(
  req: express.Request,
  res: express.Response,
  projectId: unknown
): Promise<{ userId: string; projectId: string } | null> {
  const userId = req.context?.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized. Please provide authorization token.' });

    return null;
  }

  if (!projectId || typeof projectId !== 'string') {
    res.status(400).json({ error: 'projectId query parameter is required' });

    return null;
  }

  try {
    await checkUserInWorkspaceByProjectId(req.context, projectId);
  } catch (error) {
    res.status(403).json({ error: error instanceof Error ? error.message : 'You have no access to this workspace' });

    return null;
  }

  return {
    userId,
    projectId,
  };
}

/**
 * Create AI assistant router
 *
 * @returns Express router with AI assistant endpoints
 */
export function createAiStreamRouter(): express.Router {
  const router = express.Router();

  /**
   * GET /integration/ai/stream?projectId=<projectId>&eventId=<eventId>&originalEventId=<originalEventId>
   * Stream an AI suggestion for the event
   */
  router.get('/stream', async (req, res, next) => {
    try {
      const { projectId, eventId, originalEventId } = req.query;

      const authResult = await authorizeProjectAccess(req, res, projectId);

      if (!authResult) {
        return;
      }

      if (!eventId || typeof eventId !== 'string') {
        res.status(400).json({ error: 'eventId query parameter is required' });

        return;
      }

      if (!originalEventId || typeof originalEventId !== 'string') {
        res.status(400).json({ error: 'originalEventId query parameter is required' });

        return;
      }

      const eventsFactory = getEventsFactory(req.context, authResult.projectId);

      let result;

      try {
        result = await askAiService.streamSuggestion(eventsFactory, eventId, originalEventId);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'Event not found') {
          throw error;
        }

        res.status(404).json({ error: error.message });

        return;
      }

      result.pipeTextStreamToResponse(res);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

/**
 * Append AI assistant routes to Express app
 *
 * @param app - Express application instance
 */
export function appendAiAssistantRoutes(app: express.Application): void {
  app.use('/integration/ai', createAiStreamRouter());
}
