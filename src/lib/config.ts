import { loadConfig } from 'config-loader';
import * as process from 'process';
import arg from 'arg';
import path from 'path';

/**
 * Application configuration
 */
interface AppConfig {
    /**
     * Port to listen on
     */
    port: number;

    /**
     * Host to listen on
     */
    host: string;

    /**
     * Authentication configuration
     */
    auth: AuthConfig;

    /**
     * Databases configuration
     */
    databases: DatabasesConfig;

    /**
     * Prometheus configuration
     */
    metrics: MetricsConfig;
}

/**
 * Authentication configuration
 */
interface AuthConfig {
    /**
     * Secret for signing access tokens
     */
    accessTokenSecret: string;

    /**
     * Secret for signing refresh tokens
     */
    refreshTokenSecret: string;
}

/**
 * Database configuration
 */
interface DatabasesConfig {
    /**
     * MongoDB URI for accounts database
     */
    mongodbAccountsUri: string;

    /**
     * MongoDB URI for events database
     */
    mongodbEventsUri: string;
}

/**
 * Prometheus configuration
 */
interface MetricsConfig {
    /**
     * Whether to enable Prometheus metrics
     */
    enabled: boolean

    /**
     * Prometheus metrics server host
     */
    host: string

    /**
     * Prometheus metrics server port
     */
    port: number
}

const args = arg({ /* eslint-disable @typescript-eslint/naming-convention */
  '--config': [ String ],
  '-c': '--config',
});

const cwd = process.cwd();
const paths = (args['--config'] || []).map((configPath) => {
  if (path.isAbsolute(configPath)) {
    return configPath;
  }

  return path.join(cwd, configPath);
});

const config = loadConfig<AppConfig>(...paths);

export default config;
