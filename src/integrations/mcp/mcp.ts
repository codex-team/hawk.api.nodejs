import express from "express";
import { McpServer, ServerContext } from '@modelcontextprotocol/server';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { ContextFactories, UserJWTData } from 'src/types/graphql';
import jwt from "jsonwebtoken";

/**
 * Create MCP router
 *
 * @param factories - context factories for database access
 * @returns Express router with MCP integration endpoints
 */
export const createMCPRouter = (factories: ContextFactories): express.Router => {
  const router = express.Router();
  const server = createMCPServer(factories);

  /**
   * POST /integration/mcp
   * Initiate MCP integration connection
   */
  router.post("/", async (req, res, next) => {
    try {
      /**
       * Each request must use its own transport
       */
      const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      next(error);
    }
  });

  return router;
};

/**
 * Create MCP server
 * 
 * @param factories - context factories for database access
 * @returns configured MCP server 
 */
const createMCPServer = (factories: ContextFactories) => {
  const server = new McpServer({
    name: "server",
    version: "0.0.0",
    description: "A test server"
  });

  server.registerTool(
    "hello_world",
    {
      description: "A test tool to greet the user"
    },
    async () => {
      return {
        content: [
          {
            type: "text" as const,
            text: "Hi"
          }
        ]
      }
    }
  );

  server.registerTool(
    "print_userId",
    {
      description: "A test tool that pritn userId from auth token"
    },
    async (ctx: ServerContext) => {
      const token = ctx.http?.req?.headers.get("authorization")?.slice(7)!;
      
      const auth = jwt.decode(token) as UserJWTData;
      return {
        content: [
          {
            type: "text" as const,
            text: String(auth.userId)
          }
        ]
      }
    }
  );

  return server;
};
