import express from "express";
import { McpServer } from '@modelcontextprotocol/server';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { ContextFactories } from 'src/types/graphql';


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
)

const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });

server.connect(transport);

export const createMCPRouter = (factories: ContextFactories): express.Router => {
  const router = express.Router();

  router.post("/", async (req, res, next) => {
    try {
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      next(error);
    }
  });

  return router;
};
