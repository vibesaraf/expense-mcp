/**
 * Scope Constants
 *
 * These must match the scopes configured in LoginRadius:
 * 1. Go to LoginRadius dashboard → MCP app
 * 2. Configure scopes for the MCP application
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
