import DescopeClient from '@descope/node-sdk';
import { DescopeMcpProvider } from '@descope/mcp-express';
import { config } from './index';
import { McpScopes } from './constants';

/**
 * Initialize Descope client for session validation
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const descopeClient: any = DescopeClient({
    projectId: config.DESCOPE_PROJECT_ID,
    ...(config.DESCOPE_MANAGEMENT_KEY && { managementKey: config.DESCOPE_MANAGEMENT_KEY }),
    ...(config.DESCOPE_BASE_URL && { baseUrl: config.DESCOPE_BASE_URL }),
});

/**
 * Initialize Descope MCP Provider for MCP server
 */
export const descopeMcpProvider = new DescopeMcpProvider({
    projectId: config.DESCOPE_PROJECT_ID,
    serverUrl: config.SERVER_URL,
    ...(config.DESCOPE_BASE_URL && { baseUrl: config.DESCOPE_BASE_URL }),
    verifyTokenOptions: {
        // All scopes that our MCP server supports
        requiredScopes: [], // Don't require any scopes by default, check per-tool
    },
});

/**
 * Get all supported MCP scopes
 */
export function getSupportedScopes(): string[] {
    return Object.values(McpScopes);
}
