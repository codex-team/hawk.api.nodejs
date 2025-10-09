import client from 'prom-client';
import { GraphQLRequestContext } from 'apollo-server-plugin-base';
import { GraphQLError } from 'graphql';

/**
 * GraphQL operation duration histogram
 * Tracks GraphQL operation duration by operation name and type
 */
export const gqlOperationDuration = new client.Histogram({
  name: 'hawk_gql_operation_duration_seconds',
  help: 'Histogram of total GraphQL operation duration by operation name and type',
  labelNames: ['operation_name', 'operation_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
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
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

/**
 * Apollo Server plugin to track GraphQL metrics
 */
export const graphqlMetricsPlugin = {
  async requestDidStart(requestContext: GraphQLRequestContext) {
    const startTime = Date.now();
    let operationName = 'unknown';
    let operationType = 'unknown';

    return {
      async didResolveOperation(requestContext: GraphQLRequestContext) {
        operationName = requestContext.operationName || 'anonymous';
        operationType = requestContext.operation?.operation || 'unknown';
      },

      async executionDidStart() {
        return {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          willResolveField({ info }: any) {
            const fieldStartTime = Date.now();

            return () => {
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

      async willSendResponse(requestContext: GraphQLRequestContext) {
        const duration = (Date.now() - startTime) / 1000;

        gqlOperationDuration
          .labels(operationName, operationType)
          .observe(duration);

        // Track errors if any
        if (requestContext.errors && requestContext.errors.length > 0) {
          requestContext.errors.forEach((error: GraphQLError) => {
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
