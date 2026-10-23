import jwt from "jsonwebtoken";
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler, McpServer, ServerContext } from '@modelcontextprotocol/server';
import { ContextFactories, UserJWTData } from 'src/types/graphql';

import type { NodeMcpRequestHandler } from '@modelcontextprotocol/node';

/**
 * Creates MCP server
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

/**
 * Creates MCP request handler
 *
 * @param factories - context factories for database access
 * @returns MCP RequestHandler
 */
export function createMCPHandler(factories: ContextFactories): NodeMcpRequestHandler {
  const server = createMCPServer(factories);

  const handler = createMcpHandler(() => server);

  return toNodeHandler(handler);
};
