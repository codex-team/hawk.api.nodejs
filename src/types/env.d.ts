/**
 * Declaration of environment variables
 */
declare namespace NodeJS {
  /**
   * Available process.env values
   */
  export interface ProcessEnv {
    /**
     * Server port to listen
     */
    PORT: string;

    /**
     * Hawk API public URL
     * Used in OAuth flows to redirect to callback endpoints
     * Should match OAuth app callback URLs configured in GitHub App settings
     *
     * @example "http://localhost:4000" (local development)
     * @example "https://api.stage.hawk.so" (staging)
     * @example "https://api.hawk.so" (production)
     */
    API_URL?: string;

    /**
     * Metrics server port
     */
    METRICS_PORT: string;

    /**
     * MongoDB url
     */
    MONGO_URL: string;

    /**
     * Registry url
     */
    AMQP_URL: string;

    /**
     * Secret string for encoding/decoding user's tokens
     */
    JWT_SECRET_AUTH: string;

    /**
     * SSO Service Provider Entity ID
     * Unique identifier for Hawk in SAML IdP configuration
     *
     * @example "urn:hawk:tracker:saml"
     */
    SSO_SP_ENTITY_ID: string;

    /**
     * SAML state store type
     * Determines which store implementation to use for SAML authentication state
     * - 'redis': Uses Redis store for multi-instance support (default)
     * - 'memory': Uses in-memory store (single instance only)
     *
     * @default 'redis'
     * @example "redis" or "memory"
     */
    SAML_STORE_TYPE?: string;

    /**
     * Redis connection URL
     * Used for caching and TimeSeries data
     *
     * @example "redis://redis:6379" (Docker) or "redis://localhost:6379" (local)
     */
    REDIS_URL?: string;

    /**
     * GitHub App ID
     * Unique identifier for the GitHub App
     *
     * @example "123456"
     */
    GITHUB_APP_ID?: string;

    /**
     * GitHub App private key
     * PEM-encoded private key for the GitHub App
     * Can be provided as multiline string or single line with \n escapes
     *
     * @example "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
     */
    GITHUB_PRIVATE_KEY?: string;

    /**
     * GitHub App webhook secret
     * Secret used to verify webhook payloads from GitHub
     *
     * @example "your_webhook_secret_here"
     */
    GITHUB_WEBHOOK_SECRET?: string;

    /**
     * GitHub App slug/name
     * Used to generate installation URLs
     *
     * @example "my-github-app"
     */
    GITHUB_APP_SLUG?: string;
  }
}
