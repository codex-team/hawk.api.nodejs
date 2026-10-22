import jwt from "jsonwebtoken";

import type { Secret } from "jsonwebtoken";
import type { UserJWTData } from "src/types/graphql";

/**
 * Decodes JWT and extracts UserJWTData
 * 
 * @param token - JWT
 * @returns UserJWTData or null if JWT can not be verified
 */
export function getUserJWTDataFromToken(token: string): UserJWTData | null {
  try {
    return jwt.verify(
      token,
      process.env.JWT_SECRET_ACCESS_TOKEN as Secret
    ) as UserJWTData;  
  } catch {
    return null;
  }
};
