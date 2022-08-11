import type { UserInContext } from '../types/graphql.js';
import { AuthenticationError } from 'apollo-server-core';

/**
 * Checks if user is authenticated
 *
 * @param ctxUser - user data in request context
 */
export default function ensureAuthedUser(ctxUser: UserInContext): string {
  if (!ctxUser.id) {
    throw new AuthenticationError('You are not authorized');
  }

  if (ctxUser.accessTokenExpired) {
    throw new AuthenticationError('Your access token is expired');
  }

  return ctxUser.id;
}
