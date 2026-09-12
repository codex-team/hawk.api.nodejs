import express from "express";
import { ContextFactories } from "src/types/graphql";
import { createMCPRouter } from "./mcp";
import { useMCPAuth, authMiddleware } from "./auth";

export function appendMCPRoutes(
  app: express.Application,
  factories: ContextFactories
) {
  useMCPAuth(app);
  const router = createMCPRouter(factories);

  /**
   * MCP
   */
  app.use("/integration/mcp", authMiddleware, router);
};
