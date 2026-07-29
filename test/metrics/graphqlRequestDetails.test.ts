import { buildGraphqlRequestContext } from '../../src/metrics/graphqlRequestDetails';

describe('buildGraphqlRequestContext', () => {
  it('should include user, highlighted ids and sanitized variables', () => {
    const context = buildGraphqlRequestContext({
      context: {
        user: {
          id: 'user-1',
          accessTokenExpired: false,
        },
      },
      request: {
        variables: {
          projectId: '6989be3a0bc03531cc430c72',
          input: {
            workspaceId: 'workspace-1',
            password: 'secret',
          },
          search: 'TypeError',
        },
      },
    } as never);

    expect(context).toEqual({
      userId: 'user-1',
      ids: {
        projectId: '6989be3a0bc03531cc430c72',
        'input.workspaceId': 'workspace-1',
        search: 'TypeError',
      },
      variables: '{"projectId":"6989be3a0bc03531cc430c72","input":{"workspaceId":"workspace-1","password":"[redacted]"},"search":"TypeError"}',
    });
  });
});
