import UsersFactory from '../models/usersFactory';
import WorkspacesFactory from '../models/workspacesFactory';

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
export interface UserJWTData {
  /**
   * User id
   */
  userId: string;
}

/**
 * Factories for working with models
 */
export interface ContextFactories {
  /**
   * Users factory for working with users
   */
  usersFactory: UsersFactory;

  /**
   * Workspaces factory for working with workspaces
   */
  workspacesFactory: WorkspacesFactory;
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
