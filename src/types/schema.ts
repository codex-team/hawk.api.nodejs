/* eslint-disable */
// @ts-ignore
// AUTO GENERATED FILE - DO NOT EDIT
// USE `yarn codegen` command

import type { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import type { ResolverContextBase } from './graphql.js';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  DateTime: any;
  JSON: any;
  JSONObject: any;
  Upload: any;
};

/** API mutations */
export type Mutation = {
  __typename?: 'Mutation';
  /** Unused field to let extend this type */
  _?: Maybe<Scalars['Boolean']>;
  /** Mutations for manipulating with User and authentication */
  user: UserMutations;
};

/** API queries */
export type Query = {
  __typename?: 'Query';
  /** Healthcheck endpoint */
  health: Scalars['String'];
  /** Returns authenticated user data */
  me?: Maybe<User>;
};

/** Authentication tokens */
export type TokenPair = {
  __typename?: 'TokenPair';
  /** User's access token */
  accessToken: Scalars['String'];
  /** User's refresh token for getting new token pair */
  refreshToken: Scalars['String'];
};

/** Represent User type */
export type User = {
  __typename?: 'User';
  /** User's email */
  email?: Maybe<Scalars['String']>;
  /** User's id */
  id: Scalars['ID'];
  /** User's image */
  image?: Maybe<Scalars['String']>;
  /** User's name */
  name?: Maybe<Scalars['String']>;
  /** Date of registration */
  registrationDate: Scalars['DateTime'];
};

/** Mutations for manipulating with User and authentication */
export type UserMutations = {
  __typename?: 'UserMutations';
  /** Change user password */
  changePassword: Scalars['Boolean'];
  /** Login user with provided email and password */
  login: TokenPair;
  /** Update user's tokens pair */
  refreshTokens: TokenPair;
  /** Reset user's password */
  resetPassword: Scalars['Boolean'];
  /** Register user with provided email. Returns true if registered */
  signUp: Scalars['Boolean'];
};


/** Mutations for manipulating with User and authentication */
export type UserMutationsChangePasswordArgs = {
  newPassword: Scalars['String'];
  oldPassword: Scalars['String'];
};


/** Mutations for manipulating with User and authentication */
export type UserMutationsLoginArgs = {
  email: Scalars['String'];
  password: Scalars['String'];
};


/** Mutations for manipulating with User and authentication */
export type UserMutationsRefreshTokensArgs = {
  refreshToken: Scalars['String'];
};


/** Mutations for manipulating with User and authentication */
export type UserMutationsResetPasswordArgs = {
  email: Scalars['String'];
};


/** Mutations for manipulating with User and authentication */
export type UserMutationsSignUpArgs = {
  email: Scalars['String'];
};



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  Boolean: ResolverTypeWrapper<Scalars['Boolean']>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']>;
  ID: ResolverTypeWrapper<Scalars['ID']>;
  JSON: ResolverTypeWrapper<Scalars['JSON']>;
  JSONObject: ResolverTypeWrapper<Scalars['JSONObject']>;
  Mutation: ResolverTypeWrapper<{}>;
  Query: ResolverTypeWrapper<{}>;
  String: ResolverTypeWrapper<Scalars['String']>;
  TokenPair: ResolverTypeWrapper<TokenPair>;
  Upload: ResolverTypeWrapper<Scalars['Upload']>;
  User: ResolverTypeWrapper<User>;
  UserMutations: ResolverTypeWrapper<UserMutations>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Boolean: Scalars['Boolean'];
  DateTime: Scalars['DateTime'];
  ID: Scalars['ID'];
  JSON: Scalars['JSON'];
  JSONObject: Scalars['JSONObject'];
  Mutation: {};
  Query: {};
  String: Scalars['String'];
  TokenPair: TokenPair;
  Upload: Scalars['Upload'];
  User: User;
  UserMutations: UserMutations;
};

export type DefaultDirectiveArgs = {
  value: Scalars['String'];
};

export type DefaultDirectiveResolver<Result, Parent, ContextType = ResolverContextBase, Args = DefaultDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type RenameFromDirectiveArgs = {
  name: Scalars['String'];
};

export type RenameFromDirectiveResolver<Result, Parent, ContextType = ResolverContextBase, Args = RenameFromDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type RequireAdminDirectiveArgs = { };

export type RequireAdminDirectiveResolver<Result, Parent, ContextType = ResolverContextBase, Args = RequireAdminDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type RequireAuthDirectiveArgs = { };

export type RequireAuthDirectiveResolver<Result, Parent, ContextType = ResolverContextBase, Args = RequireAuthDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type RequireUserInWorkspaceDirectiveArgs = { };

export type RequireUserInWorkspaceDirectiveResolver<Result, Parent, ContextType = ResolverContextBase, Args = RequireUserInWorkspaceDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type UploadImageDirectiveArgs = { };

export type UploadImageDirectiveResolver<Result, Parent, ContextType = ResolverContextBase, Args = UploadImageDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type ValidateDirectiveArgs = {
  isEmail?: Maybe<Scalars['Boolean']>;
  notEmpty?: Maybe<Scalars['Boolean']>;
};

export type ValidateDirectiveResolver<Result, Parent, ContextType = ResolverContextBase, Args = ValidateDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export interface JsonScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['JSON'], any> {
  name: 'JSON';
}

export interface JsonObjectScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['JSONObject'], any> {
  name: 'JSONObject';
}

export type MutationResolvers<ContextType = ResolverContextBase, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  _?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  user?: Resolver<ResolversTypes['UserMutations'], ParentType, ContextType>;
};

export type QueryResolvers<ContextType = ResolverContextBase, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  health?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  me?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
};

export type TokenPairResolvers<ContextType = ResolverContextBase, ParentType extends ResolversParentTypes['TokenPair'] = ResolversParentTypes['TokenPair']> = {
  accessToken?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  refreshToken?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface UploadScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Upload'], any> {
  name: 'Upload';
}

export type UserResolvers<ContextType = ResolverContextBase, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = {
  email?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  image?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registrationDate?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type UserMutationsResolvers<ContextType = ResolverContextBase, ParentType extends ResolversParentTypes['UserMutations'] = ResolversParentTypes['UserMutations']> = {
  changePassword?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<UserMutationsChangePasswordArgs, 'newPassword' | 'oldPassword'>>;
  login?: Resolver<ResolversTypes['TokenPair'], ParentType, ContextType, RequireFields<UserMutationsLoginArgs, 'email' | 'password'>>;
  refreshTokens?: Resolver<ResolversTypes['TokenPair'], ParentType, ContextType, RequireFields<UserMutationsRefreshTokensArgs, 'refreshToken'>>;
  resetPassword?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<UserMutationsResetPasswordArgs, 'email'>>;
  signUp?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<UserMutationsSignUpArgs, 'email'>>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = ResolverContextBase> = {
  DateTime?: GraphQLScalarType;
  JSON?: GraphQLScalarType;
  JSONObject?: GraphQLScalarType;
  Mutation?: MutationResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  TokenPair?: TokenPairResolvers<ContextType>;
  Upload?: GraphQLScalarType;
  User?: UserResolvers<ContextType>;
  UserMutations?: UserMutationsResolvers<ContextType>;
};

export type DirectiveResolvers<ContextType = ResolverContextBase> = {
  default?: DefaultDirectiveResolver<any, any, ContextType>;
  renameFrom?: RenameFromDirectiveResolver<any, any, ContextType>;
  requireAdmin?: RequireAdminDirectiveResolver<any, any, ContextType>;
  requireAuth?: RequireAuthDirectiveResolver<any, any, ContextType>;
  requireUserInWorkspace?: RequireUserInWorkspaceDirectiveResolver<any, any, ContextType>;
  uploadImage?: UploadImageDirectiveResolver<any, any, ContextType>;
  validate?: ValidateDirectiveResolver<any, any, ContextType>;
};
