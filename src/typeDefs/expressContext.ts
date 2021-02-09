/**
 * Add context to express request
 */
declare namespace Express {
  export interface Request {
    context: import('../types/graphql').ResolverContextBase;
  }
}