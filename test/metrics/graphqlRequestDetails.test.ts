import { GraphQLError } from 'graphql';
import {
  buildGraphqlRequestContext,
  formatGraphqlErrorsForAlert,
} from '../../src/metrics/graphqlRequestDetails';

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

  it('should tolerate null GraphQL variables', () => {
    const context = buildGraphqlRequestContext({
      context: {
        user: {
          id: 'user-1',
          accessTokenExpired: false,
        },
      },
      request: {
        variables: null,
      },
    } as never);

    expect(context).toEqual({
      userId: 'user-1',
    });
  });
});

describe('formatGraphqlErrorsForAlert', () => {
  it('should flatten error messages into a single string', () => {
    const text = formatGraphqlErrorsForAlert([
      new GraphQLError('First error'),
      new GraphQLError('Second error'),
    ]);

    expect(text).toBe('First error; Second error');
  });

  it('should cap the number of errors and truncate long payloads', () => {
    const errors = Array.from({ length: 12 }, (_, index) => {
      return new GraphQLError(`validation failed on field_${index}: ${'x'.repeat(200)}`);
    });
    const text = formatGraphqlErrorsForAlert(errors);

    expect(text.startsWith('validation failed on field_0:')).toBe(true);
    expect(text).toContain('…(+2 more)');
    expect(text).toContain('…; …(+2 more)');
    expect(text.length).toBeLessThanOrEqual(1200);
  });
});
