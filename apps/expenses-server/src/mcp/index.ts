import { descopeMcpAuthRouter } from '@descope/mcp-express';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { descopeMcpProvider } from '../config/descope';
import type { RequestHandler } from 'express';

/**
 * Register all MCP tools
 * Tools will be implemented in Phase 6
 */
function registerTools(server: McpServer): void {
    // Placeholder - tools will be registered in Phase 6
    console.log('📦 MCP Tools registration placeholder');
    console.log('   Tools will be implemented in Phase 6');

    // For now, we'll just log that the server is ready
    // The actual tool implementations will be added in Phase 6
}

/**
 * Create the MCP router with Descope authentication
 */
export function createMcpRouter(): RequestHandler {
    return descopeMcpAuthRouter(registerTools, descopeMcpProvider);
}
