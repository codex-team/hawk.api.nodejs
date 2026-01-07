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
     * Redis connection URL
     * Used for caching and TimeSeries data
     *
     * @example "redis://redis:6379" (Docker) or "redis://localhost:6379" (local)
     */
    REDIS_URL?: string;
  }
}
