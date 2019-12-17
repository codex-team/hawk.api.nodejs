/**
 * Resolver's Context argument
 */
export interface ResolverContextBase {
  /**
   * User who makes query
   */
  user?: UserInContext;
}

/**
 * Represents User info in context
 */
export interface UserInContext {
  /**
   * User id
   */
  id?: string;

  /**
   * True if token is expired
   */
  accessTokenExpired: boolean;
}

/**
 * Data in user's access token
 */
export interface UserJWTData {
  /**
   * User id
   */
  userId: string;
}
