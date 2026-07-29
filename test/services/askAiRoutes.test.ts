import '../../src/env-test';
import express from 'express';
import { makeExpressRequest } from '../helpers/expressRequest';

import { askAiService } from '../../src/services/askAi/service';
import { getEventsFactory } from '../../src/resolvers/helpers/eventsFactory';
import { checkUserInWorkspaceByProjectId } from '../../src/directives/requireUserInWorkspace';
import { createAiStreamRouter, appendAiAssistantRoutes } from '../../src/services/askAi/routes';

jest.mock('../../src/services/askAi/service', () => ({
  askAiService: {
    streamSuggestion: jest.fn(),
  },
}));

jest.mock('../../src/resolvers/helpers/eventsFactory', () => ({
  getEventsFactory: jest.fn(),
}));

jest.mock('../../src/directives/requireUserInWorkspace', () => ({
  checkUserInWorkspaceByProjectId: jest.fn(),
}));

const mockStreamSuggestion = askAiService.streamSuggestion as jest.Mock;
const mockGetEventsFactory = getEventsFactory as jest.Mock;
const mockCheckUserInWorkspaceByProjectId = checkUserInWorkspaceByProjectId as jest.Mock;

const userId = '507f1f77bcf86cd799439011';
const projectId = '507f1f77bcf86cd799439022';
const eventId = 'event-1';
const originalEventId = 'original-event-1';

function setupApp(contextOverrides?: (req: any) => void): express.Application {
  const app = express();

  app.use((req: any, _res, next) => {
    req.context = {
      user: { id: userId },
      factories: {} as any,
    };

    if (contextOverrides) {
      contextOverrides(req);
    }

    next();
  });

  app.use('/integration/ai', createAiStreamRouter());

  return app;
}

describe('AI stream routes - GET /integration/ai/stream', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEventsFactory.mockReturnValue({});
    mockCheckUserInWorkspaceByProjectId.mockResolvedValue(undefined);
  });

  it('should return 401 when the user is not authenticated', async () => {
    const app = setupApp((req) => {
      req.context.user.id = undefined;
    });

    const response = await makeExpressRequest(app, 'GET', '/integration/ai/stream', {
      projectId,
      eventId,
      originalEventId,
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Unauthorized');
  });

  it('should return 401 when the request has no context at all', async () => {
    const app = express();

    app.use('/integration/ai', createAiStreamRouter());

    const response = await makeExpressRequest(app, 'GET', '/integration/ai/stream', {
      projectId,
      eventId,
      originalEventId,
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Unauthorized');
  });

  it('should return 400 when projectId is missing', async () => {
    const app = setupApp();

    const response = await makeExpressRequest(app, 'GET', '/integration/ai/stream', {
      eventId,
      originalEventId,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('projectId');
  });

  it('should return 400 when projectId is repeated (parsed as an array)', async () => {
    const app = setupApp();

    const response = await makeExpressRequest(app, 'GET', '/integration/ai/stream', {
      projectId: [projectId, 'another-project'],
      eventId,
      originalEventId,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('projectId');
    expect(mockCheckUserInWorkspaceByProjectId).not.toHaveBeenCalled();
  });

  it('should return 403 when the user has no access to the project workspace', async () => {
    mockCheckUserInWorkspaceByProjectId.mockRejectedValue(new Error('You have no access to this workspace'));
    const app = setupApp();

    const response = await makeExpressRequest(app, 'GET', '/integration/ai/stream', {
      projectId,
      eventId,
      originalEventId,
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('You have no access to this workspace');
  });

  it('should fall back to a generic message when the workspace check rejects with a non-Error value', async () => {
    mockCheckUserInWorkspaceByProjectId.mockRejectedValue('workspace unavailable');
    const app = setupApp();

    const response = await makeExpressRequest(app, 'GET', '/integration/ai/stream', {
      projectId,
      eventId,
      originalEventId,
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('You have no access to this workspace');
  });

  it('should return 400 when eventId is missing', async () => {
    const app = setupApp();

    const response = await makeExpressRequest(app, 'GET', '/integration/ai/stream', {
      projectId,
      originalEventId,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('eventId');
  });

  it('should return 400 when originalEventId is missing', async () => {
    const app = setupApp();

    const response = await makeExpressRequest(app, 'GET', '/integration/ai/stream', {
      projectId,
      eventId,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('originalEventId');
  });

  it('should return 404 when the event is not found', async () => {
    mockStreamSuggestion.mockRejectedValue(new Error('Event not found'));
    const app = setupApp();

    const response = await makeExpressRequest(app, 'GET', '/integration/ai/stream', {
      projectId,
      eventId,
      originalEventId,
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Event not found');
  });

  it('should forward a streamSuggestion failure other than Event not found to Express error handling', async () => {
    mockStreamSuggestion.mockRejectedValue(new Error('gateway unavailable'));
    const app = setupApp();

    await expect(
      makeExpressRequest(app, 'GET', '/integration/ai/stream', { projectId, eventId, originalEventId })
    ).rejects.toThrow('gateway unavailable');
  });

  it('should forward a non-Error streamSuggestion rejection to Express error handling', async () => {
    mockStreamSuggestion.mockRejectedValue('gateway unavailable');
    const app = setupApp();

    await expect(
      makeExpressRequest(app, 'GET', '/integration/ai/stream', { projectId, eventId, originalEventId })
    ).rejects.toBe('gateway unavailable');
  });

  it('should forward unexpected synchronous errors to Express error handling', async () => {
    mockGetEventsFactory.mockImplementation(() => {
      throw new Error('factory blew up');
    });
    const app = setupApp();

    await expect(
      makeExpressRequest(app, 'GET', '/integration/ai/stream', { projectId, eventId, originalEventId })
    ).rejects.toThrow('factory blew up');
  });

  it('should be reachable under /integration/ai/stream when wired via appendAiAssistantRoutes', async () => {
    const app = express();

    app.use((req: any, _res, next) => {
      req.context = {
        user: { id: userId },
        factories: {} as any,
      };
      next();
    });
    appendAiAssistantRoutes(app);

    const response = await makeExpressRequest(app, 'GET', '/integration/ai/stream', {
      eventId,
      originalEventId,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('projectId');
  });

  it('should stream the AI suggestion as a UI message stream with the gateway status and headers', async () => {
    mockStreamSuggestion.mockResolvedValue({
      pipeUIMessageStreamToResponse: (res: NodeJS.WritableStream & { writeHead: Function }) => {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write('data: {"type":"text-delta","id":"0","delta":"Answer"}\n\n');
        res.end();
      },
    });
    const app = setupApp();

    const response = await makeExpressRequest(app, 'GET', '/integration/ai/stream', {
      projectId,
      eventId,
      originalEventId,
    });

    expect(mockGetEventsFactory).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ id: userId }) }), projectId);
    expect(mockStreamSuggestion).toHaveBeenCalledWith({}, eventId, originalEventId);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/event-stream');
    expect(response.body).toContain('"type":"text-delta"');
    expect(response.body).toContain('Answer');
  });
});
