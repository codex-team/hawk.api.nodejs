import { JWT_SECRET_ACCESS_TOKEN, JWT_SECRET_REFRESH_TOKEN } from './config.js';
import * as jose from 'jose';
import type { TokensPair } from '@hawk.so/types';

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
    .sign(Uint8Array.from(JWT_SECRET_ACCESS_TOKEN, c => c.charCodeAt(0)));


  const refreshToken = await new jose.SignJWT({ userId })
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(Uint8Array.from(JWT_SECRET_REFRESH_TOKEN, c => c.charCodeAt(0)));

  return {
    accessToken,
    refreshToken,
  };
}
