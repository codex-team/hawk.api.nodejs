/**
 * Settings for client module
 */
export interface Settings {
  /**
   * Base URL for sending queries
   */
  baseURL: string;

  /**
   * Enable or disable tls verify
   */
  tlsVerify: boolean;

  /**
   * Path to ca cert file
   */
  tlsCaCertPath?: string;

  /**
   * Path to client cert file
   */
  tlsCertPath?: string;

  /**
   * Path to client keys file
   */
  tlsKeyPath?: string;
}
