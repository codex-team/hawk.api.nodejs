import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { ContextFactories } from 'src/types/graphql';

import type { NodeMcpRequestHandler } from '@modelcontextprotocol/node';

/**
 * Creates MCP server
 *
 * @param factories - context factories for database access
 * @returns configured MCP server
 */
function createMCPServer(factories: ContextFactories) {
  const server = new McpServer({
    name: 'server',
    version: '0.0.0',
    description: 'A test server',
  });

  server.registerTool(
    'hello_world',
    {
      description: 'A test tool to greet the user',
    },
    async () => {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Hi',
          },
        ],
      };
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
