import UsersFactory from '../models/usersFactory';
import WorkspacesFactory from '../models/workspacesFactory';
import { GraphQLField } from 'graphql';
import ProjectsFactory from '../models/projectsFactory';
import Accounting from '../accounting';
import PlansFactory from '../models/plansFactory';
import BusinessOperationsFactory from '../models/businessOperationsFactory';

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

  /**
   * SDK for working with CodeX Accounting API
   */
  accounting: Accounting;
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

  /**
   * Projects factory for working with projects
   */
  projectsFactory: ProjectsFactory;

  /**
   * Plans factory for working with tariff plans
   */
  plansFactory: PlansFactory;

  /**
   * Allows to work with the Business Operations models
   */
  businessOperationsFactory: BusinessOperationsFactory;
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

/**
 * Use this type when you want to show that you don't know what contains GraphQL field (to avoid 'any' type),
 * e.g. in directive definition
 */
export type UnknownGraphQLField<TContext extends ResolverContextBase = ResolverContextBase>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  = GraphQLField<any, TContext>

/**
 * Use this type when you want to show that you don't know what GraphQL field resolver returns (to avoid 'any' type),
 * e.g. in directive definition
 */
export type UnknownGraphQLResolverResult
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  = Promise<any>;
