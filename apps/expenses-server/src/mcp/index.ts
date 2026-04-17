import { randomUUID } from "node:crypto";
import type { RequestHandler, Request, Response } from "express";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { config } from "../config/index.js";
import { mcpAuthMiddleware } from "./auth.js";
import {
  submitExpenseTool,
  listMyExpensesTool,
  listTeamExpensesTool,
  approveExpenseTool,
  rejectExpenseTool,
  generateReportTool,
  whoAmITool,
} from "./tools/index.js";

/**
 * Register all MCP tools
 */
function registerTools(server: McpServer): void {
  submitExpenseTool(server);
  listMyExpensesTool(server);
  listTeamExpensesTool(server);
  approveExpenseTool(server);
  rejectExpenseTool(server);
  generateReportTool(server);
  whoAmITool(server);
}

function createServer(): McpServer {
  const server = new McpServer({
    name: config.MCP_SERVER_NAME,
    version: config.MCP_SERVER_VERSION,
  });

  registerTools(server);
  return server;
}

function getHeaderValue(
  header: string | string[] | undefined,
): string | undefined {
  if (!header) {
    return undefined;
  }

  return Array.isArray(header) ? header[0] : header;
}

function isInitRequest(body: unknown): boolean {
  if (Array.isArray(body)) {
    return body.some((entry) => isInitializeRequest(entry));
  }

  return isInitializeRequest(body);
}

/**
 * Create the MCP router with LoginRadius authentication
 */
export function createMcpRouter(): RequestHandler {
  const router = express.Router();
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  const mcpPostHandler = async (req: Request, res: Response) => {
    const sessionId = getHeaderValue(req.headers["mcp-session-id"]);

    try {
      if (sessionId && transports[sessionId]) {
        await transports[sessionId].handleRequest(req, res, req.body);
        return;
      }

      if (!sessionId && isInitRequest(req.body)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (initializedSessionId) => {
            transports[initializedSessionId] = transport;
          },
        });

        transport.onclose = () => {
          const closedSessionId = transport.sessionId;
          if (closedSessionId && transports[closedSessionId]) {
            delete transports[closedSessionId];
          }
        };

        const server = createServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  };

  const mcpGetHandler = async (req: Request, res: Response) => {
    const sessionId = getHeaderValue(req.headers["mcp-session-id"]);
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    await transports[sessionId].handleRequest(req, res);
  };

  const mcpDeleteHandler = async (req: Request, res: Response) => {
    const sessionId = getHeaderValue(req.headers["mcp-session-id"]);
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    try {
      await transports[sessionId].handleRequest(req, res);
    } catch (error) {
      console.error("Error handling MCP session termination:", error);
      if (!res.headersSent) {
        res.status(500).send("Error processing session termination");
      }
    }
  };

  router.post("/mcp", mcpAuthMiddleware, mcpPostHandler);
  router.get("/mcp", mcpAuthMiddleware, mcpGetHandler);
  router.delete("/mcp", mcpAuthMiddleware, mcpDeleteHandler);

  return router;
}
