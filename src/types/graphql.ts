/**
 * Resolver's Context argument
 */
export interface ResolverContextBase {
  user?: UserInContext
}

export interface UserInContext {
  id?: string;
  accessTokenExpired: boolean;
}

export interface UserJWTData {
  userId: string;
}
