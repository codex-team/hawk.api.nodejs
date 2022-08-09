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

const accessTokenKey = Uint8Array.from(config.auth.accessTokenSecret, c => c.charCodeAt(0));
const refreshTokenKey = Uint8Array.from(config.auth.refreshTokenSecret, c => c.charCodeAt(0));

/**
 * Generates tokens pair for authentication
 *
 * @param userId - user id to generate tokens pair for
 */
export async function generateTokensPair(userId: string): Promise<TokensPair> {
  const accessToken = await new jose.SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(accessTokenKey);

  const refreshToken = await new jose.SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(refreshTokenKey);

  return {
    accessToken,
    refreshToken,
  };
}

/**
 * Verifies auth token and returns its payload
 *
 * @param token - token to verify
 * @param secret - secret for verification
 */
async function verifyJwt(token: string, secret: Uint8Array): Promise<JwtPayload> {
  const data = await jose.jwtVerify(token, secret);

  return data.payload as unknown as JwtPayload;
}

/**
 * Verify refresh token and return its payload
 *
 * @param token - token to verify
 */
export async function verifyRefreshToken(token: string): Promise<JwtPayload> {
  return verifyJwt(token, refreshTokenKey);
}


/**
 * Verify access token and return its payload
 *
 * @param token - token to verify
 */
export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  return verifyJwt(token, refreshTokenKey);
}
