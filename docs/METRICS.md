# Prometheus Metrics

This application exposes Prometheus-compatible metrics on a separate port from the main API server.

## Configuration

The metrics server runs on a separate port configured via the `METRICS_PORT` environment variable:

```bash
# Default: 9090
METRICS_PORT=9090
```

Add this to your `.env` file. See `.env.sample` for reference.

## Metrics Endpoint

The metrics are served at:

```
http://localhost:9090/metrics
```

(Replace `9090` with your configured `METRICS_PORT` if different)

## Available Metrics

### Default Node.js Metrics

The following default Node.js metrics are automatically collected:

- **nodejs_version_info** - Node.js version information
- **process_cpu_user_seconds_total** - Total user CPU time spent in seconds
- **process_cpu_system_seconds_total** - Total system CPU time spent in seconds
- **nodejs_heap_size_total_bytes** - Total heap size in bytes
- **nodejs_heap_size_used_bytes** - Used heap size in bytes
- **nodejs_external_memory_bytes** - External memory in bytes
- **nodejs_heap_space_size_total_bytes** - Total heap space size in bytes
- **nodejs_heap_space_size_used_bytes** - Used heap space size in bytes
- **nodejs_eventloop_lag_seconds** - Event loop lag in seconds
- **nodejs_eventloop_lag_min_seconds** - Minimum event loop lag
- **nodejs_eventloop_lag_max_seconds** - Maximum event loop lag
- **nodejs_eventloop_lag_mean_seconds** - Mean event loop lag
- **nodejs_eventloop_lag_stddev_seconds** - Standard deviation of event loop lag
- **nodejs_eventloop_lag_p50_seconds** - 50th percentile event loop lag
- **nodejs_eventloop_lag_p90_seconds** - 90th percentile event loop lag
- **nodejs_eventloop_lag_p99_seconds** - 99th percentile event loop lag

### Custom HTTP Metrics

#### http_request_duration_seconds (Histogram)

Duration of HTTP requests in seconds, labeled by:
- `method` - HTTP method (GET, POST, etc.)
- `route` - Request route/path
- `status_code` - HTTP status code

Buckets: 0.01, 0.05, 0.1, 0.5, 1, 5, 10 seconds

#### http_requests_total (Counter)

Total number of HTTP requests, labeled by:
- `method` - HTTP method (GET, POST, etc.)
- `route` - Request route/path
- `status_code` - HTTP status code

### GraphQL Metrics

#### hawk_gql_operation_duration_seconds (Histogram)

Histogram of total GraphQL operation duration by operation name and type.

Labels:
- `operation_name` - Name of the GraphQL operation
- `operation_type` - Type of operation (query, mutation, subscription)

Buckets: 0.01, 0.05, 0.1, 0.5, 1, 5, 10 seconds

**Purpose**: Identify slow API operations (P95/P99 latency).

#### hawk_gql_operation_errors_total (Counter)

Counter of failed GraphQL operations grouped by operation name and error class.

Labels:
- `operation_name` - Name of the GraphQL operation
- `error_type` - Type/class of the error

**Purpose**: Detect increased error rates and failing operations.

#### hawk_gql_resolver_duration_seconds (Histogram)

Histogram of resolver execution time per type, field, and operation.

Labels:
- `type_name` - GraphQL type name
- `field_name` - Field name being resolved
- `operation_name` - Name of the GraphQL operation

Buckets: 0.01, 0.05, 0.1, 0.5, 1, 5 seconds

**Purpose**: Find slow or CPU-intensive resolvers that degrade overall performance.

### MongoDB Metrics

#### hawk_mongo_command_duration_seconds (Histogram)

Histogram of MongoDB command duration by command, collection family, and database.

Labels:
- `command` - MongoDB command name (find, insert, update, etc.)
- `collection_family` - Collection family name (extracted from dynamic collection names to reduce cardinality)
- `db` - Database name

Buckets: 0.01, 0.05, 0.1, 0.5, 1, 5, 10 seconds

**Purpose**: Detect slow queries and high-latency collections.

**Note on Collection Families**: To reduce metric cardinality, dynamic collection names are grouped into families. For example:
- `events:projectId` → `events`
- `dailyEvents:projectId` → `dailyEvents`
- `repetitions:projectId` → `repetitions`
- `membership:userId` → `membership`
- `team:workspaceId` → `team`

This prevents metric explosion when dealing with thousands of projects, users, or workspaces, while still providing meaningful insights into collection performance patterns.

#### hawk_mongo_command_errors_total (Counter)

Counter of failed MongoDB commands grouped by command and error code.

Labels:
- `command` - MongoDB command name
- `error_code` - MongoDB error code

**Purpose**: Track transient or persistent database errors.

## Testing

### Manual Testing

You can test the metrics endpoint using curl:

```bash
curl http://localhost:9090/metrics
```

Or run the provided test script:

```bash
./test-metrics.sh
```

### Integration Tests

Integration tests for metrics are located in `test/integration/cases/metrics.test.ts`.

Run them with:

```bash
npm run test:integration
```

## Implementation Details

The metrics implementation uses the `prom-client` library and consists of:

1. **Metrics Module** (`src/metrics/index.ts`):
   - Initializes a Prometheus registry
   - Configures default Node.js metrics collection
   - Defines custom HTTP metrics (duration histogram and request counter)
   - Registers GraphQL and MongoDB metrics
   - Provides middleware for tracking HTTP requests
   - Creates a separate Express app for serving metrics

2. **GraphQL Metrics** (`src/metrics/graphql.ts`):
   - Implements Apollo Server plugin for tracking GraphQL operations
   - Tracks operation duration, errors, and resolver execution time
   - Automatically captures operation name, type, and field information

3. **MongoDB Metrics** (`src/metrics/mongodb.ts`):
   - Implements MongoDB command monitoring
   - Tracks command duration and errors
   - Uses MongoDB's command monitoring events
   - Extracts collection families from dynamic collection names to reduce cardinality

4. **Integration** (`src/index.ts`, `src/mongo.ts`):
   - Adds GraphQL metrics plugin to Apollo Server
   - Adds metrics middleware to the main Express app
   - Enables MongoDB command monitoring on database clients
   - Starts metrics server on a separate port
   - Keeps metrics server isolated from main API traffic

## Prometheus Configuration

To scrape these metrics with Prometheus, add the following to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'hawk-api'
    static_configs:
      - targets: ['localhost:9090']
```

Adjust the target host and port according to your deployment.
