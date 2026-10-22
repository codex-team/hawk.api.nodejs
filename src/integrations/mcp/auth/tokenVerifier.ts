import jwt from "jsonwebtoken";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";

import type { Secret } from "jsonwebtoken";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/server";
import type { TokenData } from "../types";

export function verifyToken(token: string, tokenUse: TokenData["tokenUse"]): TokenData {
  const payload = jwt.verify(token, process.env.JWT_SECRET_ACCESS_TOKEN as Secret);

  if (typeof payload === "string" || payload.tokenUse !== tokenUse ||
    typeof payload.userId !== "string" || !payload.userId ||
    typeof payload.clientId !== "string" || !payload.clientId ||
    typeof payload.exp !== "number") {
    throw new Error("Invalid token claims");
  }

  return payload as TokenData;
};

export const tokenVerifier: OAuthTokenVerifier = {
  verifyAccessToken: async (token: string) => {
    let payload: TokenData;

    try {
      payload = verifyToken(token, "access");
    } catch {
      throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid or expired access token");
    }

    return {
      token,
      clientId: payload.clientId,
      scopes: ["mcp:tools", "mcp:resources"],
      expiresAt: payload.exp
    };
  }
};