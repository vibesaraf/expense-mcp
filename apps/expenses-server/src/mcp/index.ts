import { descopeMcpAuthRouter } from "@descope/mcp-express";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { descopeMcpProvider } from "../config/descope";
import type { RequestHandler } from 'express';
import {
    submitExpenseTool,
    listMyExpensesTool,
    listTeamExpensesTool,
    approveExpenseTool,
    rejectExpenseTool,
    generateReportTool,
} from "./tools";

/**
 * Register all MCP tools
 * Tools will be implemented in Phase 6
 */
function registerTools(server: McpServer): void {
    // Register all tools
    submitExpenseTool(server);
    listMyExpensesTool(server);
    listTeamExpensesTool(server);
    approveExpenseTool(server);
    rejectExpenseTool(server);
    generateReportTool(server);
}

/**
 * Create the MCP router with Descope authentication
 */
export function createMcpRouter(): RequestHandler {
    return descopeMcpAuthRouter(registerTools, descopeMcpProvider);
}
