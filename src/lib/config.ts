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
