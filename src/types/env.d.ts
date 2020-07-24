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
  }
}
