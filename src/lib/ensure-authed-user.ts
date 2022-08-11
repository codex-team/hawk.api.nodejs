import type { ResolverContextBase } from '../types/graphql.js';
import { AuthenticationError } from 'apollo-server-core';

/**
 * Checks if user is authenticated
 *
 * @param ctx - resolver context
 */
export default function ensureAuthedUser(ctx: ResolverContextBase): string {
  if (!ctx.user.id) {
    throw new AuthenticationError('You are not authorized');
  }

  if (ctx.user.accessTokenExpired) {
    throw new AuthenticationError('Your access token is expired');
  }

  return ctx.user.id;
}
