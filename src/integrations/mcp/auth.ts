import express from "express";
import crypto from "node:crypto";
import jwt, { Secret } from "jsonwebtoken";
import { UserJWTData } from "src/types/graphql";
import { OAuthTokenVerifier } from "@modelcontextprotocol/server";
import { requireBearerAuth } from "@modelcontextprotocol/express";

if (!process.env.API_URL) {
  throw new Error('API_URL environment variable must be set to generate redirect URI');
}

if (!process.env.GARAGE_URL) {
  throw new Error('GARAGE_URL environment variable must be set to generate authorization endpoint')
}

type AuthCodeData = {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: number;
};

const authCodes = new Map<string, AuthCodeData>();

const tokenVerifier: OAuthTokenVerifier = {
  verifyAccessToken: async (token: string) => {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET_ACCESS_TOKEN as Secret
    ) as {
      userId: string;
      clientId: string;
      exp: number;
    };

    return {
      token,
      clientId: payload.clientId,
      scopes: ["mcp:tools", "mcp:resources"],
      expiresAt: payload.exp
    };
  }
};

export const authMiddleware = requireBearerAuth({
  verifier: tokenVerifier,
  resourceMetadataUrl:
    `${process.env.API_URL}/.well-known/oauth-protected-resource/integration/mcp`
});

export const useMCPAuth = (app: express.Application) => {
  /**
   * Dynamic client registration
   */
  app.post("/register/integration/mcp", (req, res) => {
    res.status(201).json({
      client_id: `hawk-client-${crypto.randomUUID()}`,
      client_name: req.body.client_name,
      redirect_uris: req.body.redirect_uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none"
    });
  });

  /**
   * Protected resource metadata
   */
  app.get(
    "/.well-known/oauth-protected-resource/integration/mcp",
    (_req, res) => {
      res.json({
        resource: `${process.env.API_URL}/integration/mcp`,
        authorization_servers: [
          `${process.env.API_URL}/integration/mcp`
        ],
        scopes_supported: [
          "mcp:tools",
          "mcp:resources"
        ]
      });
    }
  );

  /**
   * OAuth server metadata
   */
  app.get(
    "/.well-known/oauth-authorization-server/integration/mcp",
    (_req, res) => {
      res.json({
        issuer: `${process.env.API_URL}/integration/mcp`,

        authorization_endpoint:
          `${process.env.GARAGE_URL}/concent`,

        token_endpoint:
          `${process.env.API_URL}/token/integration/mcp`,

        registration_endpoint:
         `${process.env.API_URL}/register/integration/mcp`,

        response_types_supported: ["code"],

        grant_types_supported: [
          "authorization_code",
          "refresh_token"
        ],

        token_endpoint_auth_methods_supported: [
          "none"
        ],

        code_challenge_methods_supported: [
          "S256"
        ]
      });
    }
  );

  /**
   * Frontend callback
   */
  app.post("/concent/integration/mcp", (req, res) => {
    const {
      client_id,
      redirect_uri,
      state,
      code_challenge
    } = req.body;

    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "unauthorized"
      });
    }

    const loginToken = header.slice(7);

    const user = jwt.verify(
      loginToken,
      process.env.JWT_SECRET_ACCESS_TOKEN as Secret
    ) as UserJWTData;

    const code = crypto
      .randomBytes(32)
      .toString("base64url");

    authCodes.set(code, {
      userId: user.userId,
      clientId: client_id,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    /**
     * Remove authcode entry
     * if it was never used
     */
    setTimeout(() => {
      authCodes.delete(code);
    }, 5 * 60 * 1000);

    const callback = new URL(redirect_uri);

    callback.searchParams.set("code", code);

    if (state) {
      callback.searchParams.set("state", state);
    }

    return res.json({
      redirect_uri: callback.toString()
    });
  });

  /**
   * MCP client callback
   */
  app.post("/token/integration/mcp", (req, res) => {
    const {
      grant_type,
      code,
      client_id,
      redirect_uri,
      code_verifier
    } = req.body;

    if (grant_type !== "authorization_code") {
      return res.status(400).json({
        error: "unsupported_grant_type"
      });
    }

    const auth = authCodes.get(code);

    if (!auth) {
      return res.status(400).json({
        error: "invalid_grant"
      });
    }

    if (auth.expiresAt < Date.now()) {
      authCodes.delete(code);

      return res.status(400).json({
        error: "invalid_grant"
      });
    }

    if (auth.clientId !== client_id) {
      return res.status(400).json({
        error: "invalid_grant"
      });
    }

    if (auth.redirectUri !== redirect_uri) {
      return res.status(400).json({
        error: "invalid_grant"
      });
    }

    /**
     * PKCE
     */
    const calculatedChallenge = crypto
      .createHash("sha256")
      .update(code_verifier)
      .digest("base64url");

    if (calculatedChallenge !== auth.codeChallenge) {
      return res.status(400).json({
        error: "invalid_grant"
      });
    }

    authCodes.delete(code);

    const accessToken = jwt.sign(
      {
        userId: auth.userId,
        clientId: auth.clientId
      },
      process.env.JWT_SECRET_ACCESS_TOKEN as Secret,
      {
        expiresIn: "15m"
      }
    );

    const refreshToken = jwt.sign(
      {
        userId: auth.userId,
        clientId: auth.clientId
      },
      process.env.JWT_SECRET_ACCESS_TOKEN as Secret,
      { expiresIn: "30d" }
    )

    return res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "Bearer",
      expires_in: 900,
      scope: "mcp:tools mcp:resources"
    });
  });
};
