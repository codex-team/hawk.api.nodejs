import jwt from 'jsonwebtoken';

import type { Secret } from 'jsonwebtoken';
import type { UserJWTData } from 'src/types/graphql';

/**
 * Decodes JWT and extracts UserJWTData
 *
 * @param token - JWT
 * @param tokenType - type of supplied jwt token ('refresh' or 'access')
 * @returns UserJWTData or null if JWT can not be verified
 */
export function getUserJWTDataFromToken(token: string, tokenType: 'refresh' | 'access'): UserJWTData | null {
  const jwtSecret = (tokenType === 'refresh' ? process.env.JWT_SECRET_REFRESH_TOKEN : process.env.JWT_SECRET_ACCESS_TOKEN) as Secret;

  try {
    return jwt.verify(
      token,
      jwtSecret
    ) as UserJWTData;
  } catch {
    return null;
  }
};
