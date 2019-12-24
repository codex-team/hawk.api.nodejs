import UsersFactory from '../models/usersFactory';

/**
 * Resolver's Context argument
 */
export interface ResolverContextBase {
  /**
   * User who makes query
   */
  user: UserInContext;

  /**
   * Factories for working with models
   */
  factories: ContextFactories;
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
export interface AccessTokenData {
  /**
   * User id
   */
  userId: string;
}

/**
 * Data in user's refresh token
 */
export interface RefreshTokenData {
  /**
   * User id
   */
  userId: string;
  /**
   * True if it's refresh token
   * Uses for checking type of token
   */
  isRefresh: boolean;
}
/**
 * Factories for working with models
 */
export interface ContextFactories {
  /**
   * Users factory for working with users
   */
  usersFactory: UsersFactory;
}

/**
 * Resolver Context with authenticated user
 */
export interface ResolverContextWithUser extends ResolverContextBase {
  /**
   * User who makes query
   */
  user: Required<UserInContext>;
}
