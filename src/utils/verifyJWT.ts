import jwt from 'jsonwebtoken';

import type { Secret } from 'jsonwebtoken';
import type { UserJWTData } from '../types/graphql';

/**
 * Verifes given JWT token.
 * Decodes JWT and extracts UserJWTData
 *
 * @param token JWT
 * @param tokenType type of token to verify
 * @returns UserJWTData or null if JWT can not be verified
 */
export function verifyJWT<T extends UserJWTData = UserJWTData>(token: string, tokenType: 'access' | 'refresh'): T | null {
  const tokenSecret = (tokenType === 'access' 
    ? process.env.JWT_SECRET_ACCESS_TOKEN 
    : process.env.JWT_SECRET_REFRESH_TOKEN) as Secret
  
  try {
    return jwt.verify(
      token,
      tokenSecret
    ) as T;
  } catch {
    return null;
  }
};
