import client from 'prom-client';
import { ApolloServerPlugin, GraphQLRequestContext, GraphQLRequestListener } from 'apollo-server-plugin-base';
import { GraphQLError } from 'graphql';
import HawkCatcher from '@hawk.so/nodejs';

/**
 * GraphQL operation duration histogram
 * Tracks GraphQL operation duration by operation name and type
 */
export const gqlOperationDuration = new client.Histogram({
  name: 'hawk_gql_operation_duration_seconds',
  help: 'Histogram of total GraphQL operation duration by operation name and type',
  labelNames: ['operation_name', 'operation_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
});

/**
 * GraphQL operation errors counter
 * Tracks failed GraphQL operations grouped by operation name and error class
 */
export const gqlOperationErrors = new client.Counter({
  name: 'hawk_gql_operation_errors_total',
  help: 'Counter of failed GraphQL operations grouped by operation name and error class',
  labelNames: ['operation_name', 'error_type'],
});

/**
 * GraphQL resolver duration histogram
 * Tracks resolver execution time per type, field, and operation
 */
export const gqlResolverDuration = new client.Histogram({
  name: 'hawk_gql_resolver_duration_seconds',
  help: 'Histogram of resolver execution time per type, field, and operation',
  labelNames: ['type_name', 'field_name', 'operation_name'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

/**
 * Apollo Server plugin to track GraphQL metrics
 */
export const graphqlMetricsPlugin: ApolloServerPlugin = {
  async requestDidStart(_requestContext: GraphQLRequestContext): Promise<GraphQLRequestListener> {
    const startTime = Date.now();
    let operationName = 'unknown';
    let operationType = 'unknown';

    return {
      async didResolveOperation(ctx: GraphQLRequestContext): Promise<void> {
        operationName = ctx.operationName || 'anonymous';
        operationType = ctx.operation?.operation || 'unknown';
      },

      async executionDidStart(): Promise<GraphQLRequestListener> {
        return {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          willResolveField({ info }: any): () => void {
            const fieldStartTime = Date.now();

            return (): void => {
              const duration = (Date.now() - fieldStartTime) / 1000;

              gqlResolverDuration
                .labels(
                  info.parentType.name,
                  info.fieldName,
                  operationName
                )
                .observe(duration);
            };
          },
        };
      },

      async willSendResponse(ctx: GraphQLRequestContext): Promise<void> {
        const durationMs = Date.now() - startTime;
        const duration = durationMs / 1000;

        gqlOperationDuration
          .labels(operationName, operationType)
          .observe(duration);

        const hasErrors = ctx.errors && ctx.errors.length > 0;

        const breadcrumbData: Record<string, string | number> = {
          operationName,
          operationType,
          durationMs,
        };

        if (hasErrors) {
          breadcrumbData.errors = ctx.errors!.map((e: GraphQLError) => e.message).join('; ');
        }

        HawkCatcher.breadcrumbs.add({
          type: 'request',
          category: 'gql',
          message: `${operationType} ${operationName} ${durationMs}ms${hasErrors ? ` [${ctx.errors!.length} error(s)]` : ''}`,
          level: hasErrors ? 'error' : 'debug',
          data: breadcrumbData,
        });

        // Track errors if any
        if (hasErrors) {
          ctx.errors!.forEach((error: GraphQLError) => {
            const errorType = error.extensions?.code || error.name || 'unknown';

            gqlOperationErrors
              .labels(operationName, errorType as string)
              .inc();
          });
        }
      },
    };
  },
};
