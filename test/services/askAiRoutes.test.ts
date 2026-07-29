import '../../src/env-test';
import express from 'express';
import { makeExpressRequest } from '../helpers/expressRequest';

import { askAiService } from '../../src/services/askAi/service';
import { getEventsFactory } from '../../src/resolvers/helpers/eventsFactory';
import { checkUserInWorkspaceByProjectId } from '../../src/directives/requireUserInWorkspace';
import { createAiStreamRouter, appendAiAssistantRoutes } from '../../src/services/askAi/routes';
import type { AiStreamPart } from '@hawk.so/types';

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

/**
 * Answer the route with a canned suggestion stream
 *
 * @param parts - parts the service hands to the route
 */
function aiStreamOf(parts: AiStreamPart[]): void {
  mockStreamSuggestion.mockResolvedValue((async function * () {
    yield* parts;
  })());
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

  it('should generate the suggestion for the requested event of the authorized project', async () => {
    aiStreamOf([
      {
        type: 'text-delta',
        delta: 'The stack trace ',
      },
      {
        type: 'text-delta',
        delta: 'points at a null dereference',
      },
    ]);
    const app = setupApp();

    const response = await makeExpressRequest(app, 'GET', '/integration/ai/stream', {
      projectId,
      eventId,
      originalEventId,
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/event-stream');
    expect(response.body).toBe(
      'data: {"type":"text-delta","delta":"The stack trace "}\n\n' +
      'data: {"type":"text-delta","delta":"points at a null dereference"}\n\n'
    );
  });

  it('should abort answer generation once the connection is closed', async () => {
    let closeConnection = (): void => {};

    mockStreamSuggestion.mockResolvedValue((async function * () {
      yield {
        type: 'text-delta',
        delta: 'read by the client',
      };
      closeConnection();
      yield {
        type: 'text-delta',
        delta: 'written after the client left',
      };
    })());
    const app = setupApp();

    const response = await makeExpressRequest(
      app,
      'GET',
      '/integration/ai/stream',
      {
        projectId,
        eventId,
        originalEventId,
      },
      (res) => {
        closeConnection = (): void => {
          res.emit('close');
        };
      }
    );

    expect(response.body).toBe('data: {"type":"text-delta","delta":"read by the client"}\n\n');
  });

  it('should send a error part when the underlying stream throws', async () => {
    mockStreamSuggestion.mockResolvedValue((async function * () {
      yield {
        type: 'text-delta',
        delta: 'The stack trace ',
      };
      throw new Error('gateway unavailable');
    })());
    const app = setupApp();

    const response = await makeExpressRequest(app, 'GET', '/integration/ai/stream', {
      projectId,
      eventId,
      originalEventId,
    });

    expect(response.status).toBe(200);
    expect(response.body).toBe(
      'data: {"type":"text-delta","delta":"The stack trace "}\n\n' +
      'data: {"type":"error","errorText":"gateway unavailable"}\n\n'
    );
  });
});
