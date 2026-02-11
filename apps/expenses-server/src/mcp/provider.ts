// =============================================================================
// MCP Provider Configuration
// =============================================================================
// This file configures the DescopeMcpProvider which handles:
// - OAuth 2.1 metadata endpoints
// - Bearer token validation
// - Scope enforcement
// =============================================================================

import { DescopeMcpProvider } from "@descope/mcp-express";
import { config } from "../config";

/**
 * MCP Provider Configuration
 * 
 * The provider runs in "Resource Server" mode by default (recommended).
 * This means:
 * - It exposes OAuth metadata endpoints
 * - It validates Bearer tokens on /mcp requests
 * - Authorization Server features are handled by Descope
 * 
 * Scopes are defined in the Descope Console under "Inbound Apps" → "MCP Server"
 */
export const mcpProvider = new DescopeMcpProvider({
    // Required: Your Descope Project ID
    projectId: config.DESCOPE_PROJECT_ID,
    managementKey: config.DESCOPE_MANAGEMENT_KEY,

    // Required: The public URL of your MCP server
    // Used in OAuth metadata endpoints
    serverUrl: config.SERVER_URL,
    baseUrl: config.DESCOPE_BASE_URL,

    // Enable Authorization Server mode (disabled by default)
    authorizationServerOptions: {
        isDisabled: false,  // Enable Authorization Server mode
        enableAuthorizeEndpoint: true,  // Expose /authorize
        enableDynamicClientRegistration: true,  // Expose /register
    },

    // Optional: Custom Descope base URL (for self-hosted or regional deployments)
    // baseUrl: config.DESCOPE_BASE_URL,

    // Optional: Token verification options
    verifyTokenOptions: {
        // Scopes that are required for ALL tools by default
        // Individual tools can override this with their own scope requirements
        // requiredScopes: ["openid"],

        // Optional: Resource indicator for RFC 8707 compliance
        // resourceIndicator: config.server.url,

        // Optional: Expected audience claim in the token
        // audience: config.descope.projectId,
    },

    // Configure DCR options
    dynamicClientRegistrationOptions: {
        authPageUrl: `https://api.descope.com/login/${config.DESCOPE_PROJECT_ID}?flow=inbound-apps-user-consent`,
        permissionScopes: [
            { name: "openid", description: "Basic identity information" },
            { name: "profile", description: "User profile information" },
            { name: "expense:submit", description: "Submit new expense reports", required: true },
            { name: "expense:view:own", description: "View own expenses", required: true },
            { name: "expense:view:team", description: "View team expenses" },
            { name: "expense:view:all", description: "View all expenses" },
            { name: "expense:approve", description: "Approve or reject expenses" },
            { name: "expense:report:generate", description: "Generate expense reports" },
        ],
        nonConfidentialClient: true,  // For public clients like VS Code
    },
});

/**
 * Scope Constants
 * 
 * These must match the scopes configured in Descope Console:
 * 1. Go to Descope Console → Inbound Apps
 * 2. Create an MCP Server
 * 3. Define these scopes with descriptions
 */
export const MCP_SCOPES = {
    // Basic scopes
    OPENID: "openid",

    // Expense submission
    EXPENSE_SUBMIT: "expense:submit",

    // Expense viewing
    EXPENSE_VIEW_OWN: "expense:view:own",
    EXPENSE_VIEW_TEAM: "expense:view:team",
    EXPENSE_VIEW_ALL: "expense:view:all",

    // Expense approval
    EXPENSE_APPROVE: "expense:approve",

    // Report generation
    EXPENSE_REPORT: "expense:report:generate",
} as const;

export type McpScope = (typeof MCP_SCOPES)[keyof typeof MCP_SCOPES];
