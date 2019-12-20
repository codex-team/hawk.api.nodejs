/**
 * Resolver's Context argument
 */
import UsersFactory from "../models/usersFactory";

export interface ResolverContextBase {
  /**
   * User who makes query
   */
  user: UserInContext;

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
}
