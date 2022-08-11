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

const accessTokenKey = Buffer.from(config.auth.accessTokenSecret, 'utf-8');
const refreshTokenKey = Buffer.from(config.auth.refreshTokenSecret, 'utf-8');

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
  return verifyJwt(token, accessTokenKey);
}
