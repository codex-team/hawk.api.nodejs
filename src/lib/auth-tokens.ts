import config from './config.js';
import * as jose from 'jose';
import type { TokensPair } from '@hawk.so/types';

/**
 * JWT tokens payload
 */
interface JwtPayload {
  /**
   * Id of the user that token is for
   */
  userId: string;
}

/**
 * Generates tokens pair for authentication
 *
 * @param userId - user id to generate tokens pair for
 */
export async function generateTokensPair(userId: string): Promise<TokensPair> {
  const accessToken = await new jose.SignJWT({ userId })
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(Uint8Array.from(config.auth.accessTokenSecret, c => c.charCodeAt(0)));


  const refreshToken = await new jose.SignJWT({ userId })
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(Uint8Array.from(config.auth.refreshTokenSecret, c => c.charCodeAt(0)));

  return {
    accessToken,
    refreshToken,
  };
}

/**
 * Verify JWT and return its payload
 *
 * @param token - token to verify
 */
export async function verifyRefreshToken(token: string): Promise<JwtPayload> {
  const data = await jose.jwtVerify(token, Uint8Array.from(config.auth.refreshTokenSecret, c => c.charCodeAt(0)));

  return data.payload as unknown as JwtPayload;
}
