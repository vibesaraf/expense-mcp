/**
 * Scope Constants
 *
 * These must match the scopes configured in Scalekit:
 * 1. Go to Scalekit Dashboard → MCP Servers
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
